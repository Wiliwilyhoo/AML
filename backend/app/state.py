import asyncio
import os
import time
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pandas as pd
from .data import load_csv, normalize, sample_rows
from .detection import Detector, RULES, severity
from .models import RuleConfig


def utcnow():
    return datetime.now(timezone.utc).isoformat()


class State:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.config = RuleConfig()
        path = os.getenv('AML_CSV', '').strip()
        self.source = Path(path).name if path else 'Synthetic demonstration data'
        self.dataset = load_csv(path, int(os.getenv('AML_LIMIT', '50000'))) if path else normalize(pd.DataFrame(sample_rows(int(os.getenv('AML_SAMPLE_SIZE', '3000')))))
        self.evidence = {}
        self.clients = set()
        self.running = False
        self.speed = 60.0
        self.mode = 'snapshot'
        self.revision = 0
        self.rebuild(len(self.dataset))

    def rebuild(self, count: int):
        started = time.perf_counter()
        self.detector = Detector(self.config)
        self.transactions, self.alerts, self.risks, self.tx_rules = {}, {}, {}, {}
        self.cursor = 0
        self.running = False
        self.analytics_cache = None
        for tx in self.dataset[:count]:
            self.ingest(tx)
        self.detection_seconds = time.perf_counter() - started
        self.revision += 1

    def ingest(self, tx: dict):
        if tx['id'] in self.transactions:
            return []
        self.transactions[tx['id']] = tx
        generated = self.detector.process(tx)
        for alert in generated:
            self.alerts.setdefault(alert['id'], alert)
            for tid in alert['transaction_ids']:
                rules = self.tx_rules.setdefault(tid, set())
                rules.add(alert['rule_id'])
                self.risks[tid] = min(100, sum(RULES[r][2] for r in rules))
        self.cursor += 1
        self.analytics_cache = None
        self.revision += 1
        return generated

    def transaction(self, tx):
        score = self.risks.get(tx['id'], 0)
        return {**tx, 'risk_score': score, 'risk_level': severity(score), 'suspicious': score > 0,
                'rule_ids': sorted(self.tx_rules.get(tx['id'], set()))}

    def analytics(self, hours: int = 0):
        if self.analytics_cache is not None and not hours:
            return self.analytics_cache
        txs = list(self.transactions.values())
        if hours and txs:
            cutoff = datetime.fromisoformat(txs[-1]['timestamp']) - timedelta(hours=hours)
            txs = [x for x in txs if datetime.fromisoformat(x['timestamp']) >= cutoff]
        tx_ids = {x['id'] for x in txs}
        scoped_alerts = [a for a in self.alerts.values() if a['transaction_id'] in tx_ids]
        scoped_flagged = len(tx_ids & self.risks.keys())
        volumes, trend, currencies = {}, {}, {}
        accounts = set()
        severity_counts = Counter()
        for tx in txs:
            day = tx['timestamp'][:13] + ':00'
            key = (day, tx['currency'])
            volumes[key] = volumes.get(key, 0) + tx['amount']
            currencies[tx['currency']] = currencies.get(tx['currency'], 0) + tx['amount']
            flagged = tx['id'] in self.risks
            trend[day] = trend.get(day, 0) + int(flagged)
            if flagged:
                severity_counts[severity(self.risks[tx['id']])] += 1
            if self.risks.get(tx['id'], 0) >= 50:
                accounts.update([tx['sender'], tx['receiver']])
        labeled = [x for x in txs if x['label'] is not None]
        confusion = Counter(('TP' if x['label'] else 'FP') if x['id'] in self.risks else ('FN' if x['label'] else 'TN') for x in labeled)
        tp, fp, fn, tn = (confusion[k] for k in ['TP', 'FP', 'FN', 'TN'])
        ratio = lambda a, b: a/b if b else None
        precision, recall = ratio(tp, tp+fp), ratio(tp, tp+fn)
        records = [r for versions in self.evidence.values() for r in versions if r.get('receipt')]
        result = {
            'source': self.source, 'transactions': len(txs), 'volume_by_currency': currencies,
            'flagged': scoped_flagged, 'flagged_rate': ratio(scoped_flagged, len(txs)) or 0,
            'open_investigations': sum(a['status'] in {'Under Review', 'Escalated'} for a in scoped_alerts),
            'high_risk_accounts': len(accounts), 'alerts': len(scoped_alerts),
            'volume_trend': [{'time': k[0], 'currency': k[1], 'amount': round(v, 2)} for k, v in sorted(volumes.items())],
            'suspicious_trend': [{'time': k, 'count': v} for k, v in sorted(trend.items())],
            'severity': dict(severity_counts), 'rules': dict(Counter(a['rule_name'] for a in scoped_alerts)),
            'statuses': dict(Counter(a['status'] for a in scoped_alerts)),
            'recent_alerts': sorted(scoped_alerts, key=lambda a: (a['risk_score'], a['detected_at']), reverse=True)[:8],
            'activity': sorted([{'alert_id': a['id'], **h} for a in scoped_alerts for h in a['history']], key=lambda h: h['at'], reverse=True)[:10],
            'evaluation': {'available': bool(labeled), 'labeled_transactions': len(labeled),
                           'confusion': dict(confusion), 'precision': precision, 'recall': recall,
                           'f1': ratio(2*tp, 2*tp+fp+fn), 'false_positive_rate': ratio(fp, fp+tn),
                           'false_negative_rate': ratio(fn, fn+tp)},
            'detection_seconds': self.detection_seconds,
            'mean_processing_ms': self.detection_seconds/max(1, self.cursor)*1000,
            'blockchain': {'client_reported_receipts': len(records),
                          'gas_used': sum(int(r['receipt']['gas_used']) for r in records),
                          'mean_confirmation_seconds': sum(r['receipt']['confirmation_seconds'] for r in records)/len(records) if records else None},
        }
        if not hours:
            self.analytics_cache = result
        return result

    def replay_status(self):
        return {'running': self.running, 'mode': self.mode, 'cursor': self.cursor,
                'total': len(self.dataset), 'speed': self.speed, 'revision': self.revision}
