"""Chronological, incremental rules. Ground-truth labels are never read here."""
import hashlib
from collections import defaultdict, deque
from datetime import datetime, timedelta
from .models import RuleConfig

RULES = {
    'HV': ('High-value transfer', 'Amount exceeds the configured demo threshold.', 30),
    'VEL': ('Transaction velocity', 'Many outgoing transfers inside a rolling window.', 25),
    'STR': ('Possible structuring', 'Repeated outgoing transfers just below a demo threshold.', 35),
    'FIN': ('Fan-in pattern', 'Distinct source accounts send to one destination.', 30),
    'FOUT': ('Fan-out pattern', 'One source sends to distinct destination accounts.', 30),
    'RAP': ('Rapid fund movement', 'Funds received and sent onward within a short interval.', 35),
}


def severity(score: int) -> str:
    return 'Critical' if score >= 75 else 'High' if score >= 50 else 'Medium' if score >= 25 else 'Low'


class Detector:
    def __init__(self, config: RuleConfig):
        self.config = config
        self.outgoing = defaultdict(deque)
        self.incoming = defaultdict(deque)
        self.seen = set()
        self.last_time = None

    def process(self, tx: dict) -> list[dict]:
        if tx['id'] in self.seen:
            return []
        now = datetime.fromisoformat(tx['timestamp'])
        if self.last_time and now < self.last_time:
            raise ValueError('Detection requires chronological transactions')
        self.last_time = now
        self.seen.add(tx['id'])
        c = self.config
        # Currency-scoped windows avoid adding incomparable currency amounts.
        out = self.outgoing[(tx['sender'], tx['currency'])]
        inc = self.incoming[(tx['receiver'], tx['receiving_currency'])]
        received = self.incoming[(tx['sender'], tx['currency'])]
        cutoff = now - timedelta(minutes=max(c.window_minutes, c.rapid_minutes))
        for window in (out, inc, received):
            while window and datetime.fromisoformat(window[0]['timestamp']) < cutoff:
                window.popleft()
        out.append(tx)
        window_start = now - timedelta(minutes=c.window_minutes)
        outgoing = [x for x in out if datetime.fromisoformat(x['timestamp']) >= window_start]
        incoming = [x for x in inc if datetime.fromisoformat(x['timestamp']) >= window_start] + [tx]
        structured = [x for x in outgoing if c.structuring_threshold*c.structuring_floor <= x['amount'] < c.structuring_threshold]
        rapid = [x for x in received if x['id'] != tx['id'] and
                 now-timedelta(minutes=c.rapid_minutes) <= datetime.fromisoformat(x['timestamp']) < now]
        candidates = {
            'HV': [tx] if tx['amount'] > c.high_value else [],
            'VEL': outgoing if len(outgoing) >= c.velocity_count else [],
            'STR': structured if tx in structured and len(structured) >= c.structuring_count else [],
            'FIN': incoming if len({x['sender'] for x in incoming}) >= c.fan_in_count else [],
            'FOUT': outgoing if len({x['receiver'] for x in outgoing}) >= c.fan_out_count else [],
            'RAP': rapid + [tx] if rapid else [],
        }
        inc.append(tx)
        alerts = []
        for rule, supporting in candidates.items():
            if rule not in c.enabled or not supporting:
                continue
            ids = sorted({x['id'] for x in supporting})
            aid = 'AL-' + hashlib.sha256(f'{rule}|{"|".join(ids)}'.encode()).hexdigest()[:20]
            name, description, weight = RULES[rule]
            details = {
                'HV': f'Amount {tx["amount"]:g} > {c.high_value:g}.',
                'VEL': f'{len(outgoing)} outgoing transfers; minimum {c.velocity_count} in {c.window_minutes} minutes.',
                'STR': f'{len(structured)} transfers in [{c.structuring_threshold*c.structuring_floor:g}, {c.structuring_threshold:g}); minimum {c.structuring_count} in {c.window_minutes} minutes.',
                'FIN': f'{len({x["sender"] for x in incoming})} distinct senders; minimum {c.fan_in_count} in {c.window_minutes} minutes.',
                'FOUT': f'{len({x["receiver"] for x in outgoing})} distinct receivers; minimum {c.fan_out_count} in {c.window_minutes} minutes.',
                'RAP': f'{len(rapid)} earlier incoming transfers within {c.rapid_minutes} minutes.',
            }
            alerts.append({'id': aid, 'transaction_id': tx['id'], 'transaction_ids': ids,
                           'rule_id': rule, 'rule_name': name, 'severity': severity(weight),
                           'risk_score': weight, 'detected_at': tx['timestamp'], 'status': 'New',
                           'reviewer': '', 'explanation': f'{description} {details[rule]} {len(ids)} supporting transaction(s); currency {tx["currency"]}.',
                           'notes': [], 'history': []})
        return alerts
