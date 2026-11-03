import asyncio
import contextlib
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .detection import RULES
from .evidence import canonical_evidence, canonical_json, evidence_hash
from .graph import subgraph
from .models import EvidenceRequest, Note, Page, Receipt, ReplayCommand, Review, RuleConfig, TRANSITIONS
from .state import State, utcnow

logging.basicConfig(level=logging.INFO, format='%(message)s')
log = logging.getLogger('aml')


async def replay_loop(state):
    while True:
        await asyncio.sleep(0.25)
        message = None
        async with state.lock:
            if state.running and state.cursor < len(state.dataset):
                state.virtual_time += 0.25 * state.speed
                generated, processed = [], 0
                started = time.perf_counter()
                while state.cursor < len(state.dataset) and processed < 500:
                    tx = state.dataset[state.cursor]
                    if datetime.fromisoformat(tx['timestamp']).timestamp() > state.virtual_time:
                        break
                    generated.extend(state.ingest(tx))
                    processed += 1
                state.detection_seconds += time.perf_counter() - started
                state.analytics_cache = None
                if state.cursor == len(state.dataset):
                    state.running = False
                if processed:
                    message = {'type': 'replay', **state.replay_status(), 'new_alerts': len(generated)}
        if message:
            for client in list(state.clients):
                try:
                    await asyncio.wait_for(client.send_json(message), timeout=1)
                except (Exception, asyncio.TimeoutError):
                    state.clients.discard(client)


@asynccontextmanager
async def lifespan(app):
    app.state.aml = State()
    task = asyncio.create_task(replay_loop(app.state.aml))
    log.info(json.dumps({'event': 'loaded', 'transactions': len(app.state.aml.dataset), 'source': app.state.aml.source}))
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title='AML Sentinel', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('AML_CORS', 'http://localhost:5173,http://127.0.0.1:5173').split(','), allow_methods=['GET', 'POST', 'PUT'], allow_headers=['Content-Type'])


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(status_code=422, content={'detail': 'Invalid request', 'errors': json.loads(json.dumps(exc.errors(), default=str))})


@app.exception_handler(Exception)
async def internal_error(request, exc):
    log.exception(json.dumps({'event': 'request_failed', 'path': request.url.path}))
    return JSONResponse(status_code=500, content={'detail': 'Internal error. See backend logs.'})


def get_state(request: Request):
    return request.app.state.aml


def alert_or_404(state, aid):
    if aid not in state.alerts:
        raise HTTPException(404, 'Alert not found in the active session')
    return state.alerts[aid]


def validate_dates(start, end):
    parsed_dates = []
    for value in (start, end):
        if value:
            try:
                parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if parsed.tzinfo is None:
                    raise ValueError()
                parsed_dates.append(parsed)
            except ValueError:
                raise HTTPException(422, 'Dates must be ISO 8601 with a timezone')
    if len(parsed_dates) == 2 and parsed_dates[0] > parsed_dates[1]:
        raise HTTPException(422, 'Start must precede end')


@app.get('/api/health')
async def health(request: Request):
    return {'status': 'ok', 'source': get_state(request).source, 'storage': 'volatile, single worker'}


@app.get('/api/dashboard')
async def dashboard(request: Request, hours: int = Query(0, ge=0, le=8760)):
    state = get_state(request)
    async with state.lock:
        return state.analytics(hours)


@app.get('/api/transactions', response_model=Page)
async def transactions(request: Request, q: str = '', start: str | None = None, end: str | None = None,
                       min_amount: float = Query(0, ge=0), max_amount: float | None = Query(None, ge=0),
                       payment_format: str = '', risk_level: str = Query('', pattern='^(|Low|Medium|High|Critical)$'),
                       suspicious: bool | None = None, sort: str = Query('timestamp', pattern='^(timestamp|amount|risk_score|id)$'),
                       descending: bool = True, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100)):
    validate_dates(start, end)
    if max_amount is not None and min_amount > max_amount:
        raise HTTPException(422, 'Minimum amount exceeds maximum')
    state = get_state(request)
    async with state.lock:
        items = []
        for tx in state.transactions.values():
            if q.lower() not in ' '.join([tx['id'], tx['sender'], tx['receiver']]).lower():
                continue
            if (start and datetime.fromisoformat(tx['timestamp']) < datetime.fromisoformat(start.replace('Z', '+00:00'))) or (end and datetime.fromisoformat(tx['timestamp']) > datetime.fromisoformat(end.replace('Z', '+00:00'))):
                continue
            if tx['amount'] < min_amount or (max_amount is not None and tx['amount'] > max_amount) or (payment_format and tx['payment_format'] != payment_format):
                continue
            row = state.transaction(tx)
            if risk_level and row['risk_level'] != risk_level or suspicious is not None and row['suspicious'] != suspicious:
                continue
            items.append(row)
        items.sort(key=lambda x: x[sort], reverse=descending)
        return {'items': items[(page-1)*page_size:page*page_size], 'total': len(items), 'page': page, 'page_size': page_size}


@app.get('/api/transactions/{tid}')
async def transaction(request: Request, tid: str):
    state = get_state(request)
    if tid not in state.transactions:
        raise HTTPException(404, 'Transaction not found')
    tx = state.transactions[tid]
    accounts = {tx['sender'], tx['receiver']}
    return {**state.transaction(tx), 'alerts': [a for a in state.alerts.values() if tid in a['transaction_ids']],
            'related': [state.transaction(x) for x in state.transactions.values() if accounts & {x['sender'], x['receiver']}][:50]}


@app.get('/api/alerts', response_model=Page)
async def alerts(request: Request, q: str = '', status: str = '', severity: str = '', rule_id: str = '',
                 sort: str = Query('detected_at', pattern='^(detected_at|risk_score|status|id)$'), descending: bool = True,
                 page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100)):
    state = get_state(request)
    rows = [a for a in state.alerts.values() if q.lower() in f'{a["id"]} {a["transaction_id"]} {a["rule_name"]} {a["reviewer"]}'.lower() and
            (not status or a['status'] == status) and (not severity or a['severity'] == severity) and (not rule_id or a['rule_id'] == rule_id)]
    rows.sort(key=lambda a: a[sort], reverse=descending)
    return {'items': rows[(page-1)*page_size:page*page_size], 'total': len(rows), 'page': page, 'page_size': page_size}


@app.get('/api/alerts/{aid}')
async def alert_detail(request: Request, aid: str):
    state = get_state(request)
    a = alert_or_404(state, aid)
    return {**a, 'transactions': [state.transaction(state.transactions[t]) for t in a['transaction_ids']],
            'allowed_statuses': sorted(TRANSITIONS[a['status']]), 'evidence': state.evidence.get(aid, [])}


@app.post('/api/alerts/{aid}/review')
async def review(request: Request, aid: str, body: Review):
    state = get_state(request)
    async with state.lock:
        a = alert_or_404(state, aid)
        if body.status not in TRANSITIONS[a['status']]:
            raise HTTPException(409, f'Cannot move from {a["status"]} to {body.status}')
        a['history'].append({'at': utcnow(), 'from': a['status'], 'to': body.status, 'reviewer': body.reviewer, 'note': body.note})
        a.update(status=body.status, reviewer=body.reviewer)
        state.analytics_cache = None
        return a


@app.post('/api/alerts/{aid}/notes')
async def note(request: Request, aid: str, body: Note):
    state = get_state(request)
    async with state.lock:
        a = alert_or_404(state, aid)
        a['notes'].append({'at': utcnow(), **body.model_dump()})
        return a


@app.get('/api/rules')
async def rules(request: Request):
    return {'config': get_state(request).config, 'rules': [{'id': k, 'name': v[0], 'description': v[1], 'weight': v[2]} for k, v in RULES.items()]}


@app.put('/api/rules')
async def update_rules(request: Request, body: RuleConfig):
    state = get_state(request)
    async with state.lock:
        if state.running:
            raise HTTPException(409, 'Pause replay before rerunning detection')
        # Keep prior investigations when deterministic context IDs survive the rerun.
        previous = state.alerts
        count = state.cursor
        state.config = body
        state.rebuild(count)
        for aid in state.alerts.keys() & previous.keys():
            for field in ('status', 'reviewer', 'notes', 'history'):
                state.alerts[aid][field] = previous[aid][field]
        return {'alerts': len(state.alerts), 'config': state.config}


@app.get('/api/graph')
async def graph(request: Request, account: str = '', hops: int = Query(1, ge=1, le=3),
                limit: int = Query(100, ge=1, le=200), start: str | None = None, end: str | None = None,
                min_amount: float = Query(0, ge=0), risk_level: str = Query('', pattern='^(|Low|Medium|High|Critical)$')):
    validate_dates(start, end)
    return subgraph(get_state(request), account, hops, limit, start, end, min_amount, risk_level)


@app.get('/api/replay')
async def replay_status(request: Request):
    return get_state(request).replay_status()


@app.post('/api/replay')
async def replay(request: Request, body: ReplayCommand):
    state = get_state(request)
    async with state.lock:
        if body.action in {'reset', 'start'}:
            if state.mode == 'snapshot' or body.action == 'reset':
                # Documented reset: empty transactions/cases; keep evidence archive for session.
                state.rebuild(0)
                state.mode = 'replay'
                state.virtual_time = datetime.fromisoformat(state.dataset[0]['timestamp']).timestamp() if state.dataset else 0
            if body.action == 'start':
                state.running = bool(state.dataset) and state.cursor < len(state.dataset)
        elif body.action == 'pause':
            state.running = False
        elif body.action == 'resume':
            if state.mode != 'replay':
                raise HTTPException(409, 'Start replay first')
            state.running = state.cursor < len(state.dataset)
        state.speed = body.speed
        return state.replay_status()


@app.websocket('/ws/live')
async def live(ws: WebSocket):
    await ws.accept()
    state = ws.app.state.aml
    state.clients.add(ws)
    try:
        await ws.send_json({'type': 'connected', **state.replay_status()})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        state.clients.discard(ws)


@app.post('/api/alerts/{aid}/evidence')
async def evidence(request: Request, aid: str, body: EvidenceRequest):
    state = get_state(request)
    async with state.lock:
        a = alert_or_404(state, aid)
        versions = state.evidence.setdefault(aid, [])
        version = len(versions)+1
        previous = versions[-1]['hash'] if versions else '0x' + '0'*64
        payload = canonical_evidence(a, body.reviewer, version, previous)
        record = {'alert_id': aid, 'version': version, 'payload': payload, 'canonical': canonical_json(payload),
                  'hash': evidence_hash(payload), 'created_at': utcnow(), 'receipt': None}
        versions.append(record)
        return record


@app.get('/api/evidence')
async def evidence_list(request: Request):
    return [v for versions in get_state(request).evidence.values() for v in versions]


@app.post('/api/evidence/{aid}/{version}/receipt')
async def receipt(request: Request, aid: str, version: int, body: Receipt):
    state = get_state(request)
    async with state.lock:
        record = next((v for v in state.evidence.get(aid, []) if v['version'] == version), None)
        if not record:
            raise HTTPException(404, 'Evidence version not found')
        if record['hash'].lower() != body.evidence_hash.lower():
            raise HTTPException(409, 'Receipt evidence hash mismatch')
        record['receipt'] = {**body.model_dump(), 'trust': 'client-reported; verify with wallet RPC on Audit page'}
        state.analytics_cache = None
        return record
