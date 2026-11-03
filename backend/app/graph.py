from datetime import datetime


def subgraph(state, account, hops, limit, start=None, end=None, minimum=0, risk=None):
    start_time = datetime.fromisoformat(start.replace('Z', '+00:00')) if start else None
    end_time = datetime.fromisoformat(end.replace('Z', '+00:00')) if end else None
    candidates = [x for x in state.transactions.values() if x['amount'] >= minimum and
                  (not start_time or datetime.fromisoformat(x['timestamp']) >= start_time) and
                  (not end_time or datetime.fromisoformat(x['timestamp']) <= end_time) and
                  (not risk or state.transaction(x)['risk_level'] == risk)]
    if not account and candidates:
        account = next((x['sender'] for x in candidates if x['id'] in state.risks), candidates[0]['sender'])
    frontier, accounts, selected = {account}, {account}, {}
    for _ in range(hops):
        next_frontier = set()
        for tx in candidates:
            if tx['id'] in selected or not ({tx['sender'], tx['receiver']} & frontier):
                continue
            if len(selected) >= limit:
                break
            selected[tx['id']] = tx
            next_frontier.update([tx['sender'], tx['receiver']])
        frontier = next_frontier - accounts
        accounts.update(next_frontier)
    nodes = []
    for node in sorted(accounts - {None, ''}):
        related = [x for x in selected.values() if node in (x['sender'], x['receiver'])]
        score = max((state.risks.get(x['id'], 0) for x in related), default=0)
        nodes.append({'data': {'id': node, 'label': node, 'risk': score}})
    edges = [{'data': {'id': x['id'], 'source': x['sender'], 'target': x['receiver'],
                       'label': f'{x["amount"]:,.0f} {x["currency"]}', 'risk': state.risks.get(x['id'], 0)}} for x in selected.values()]
    return {'nodes': nodes, 'edges': edges, 'limited': len(selected) >= limit}
