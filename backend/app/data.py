"""Bounded IBM CSV import. Account identifiers are bank-qualified, never numeric."""
import hashlib
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pandas as pd

REQUIRED = ['timestamp', 'from_bank', 'account', 'to_bank', 'account_1',
            'amount_received', 'receiving_currency', 'amount_paid', 'payment_currency', 'payment_format']


def sample_rows(count: int = 3000, seed: int = 19) -> list[dict]:
    rng = random.Random(seed)
    base = datetime(2025, 1, 6, tzinfo=timezone.utc)
    rows = []
    for i in range(count):
        pattern, slot = divmod(i, 60)
        src, dst = f'A{rng.randrange(100):04}', f'A{rng.randrange(100):04}'
        amount, label = round(rng.uniform(20, 4500), 2), 0
        if slot < 5:
            src, dst, amount, label = f'P{pattern}', f'D{pattern}-{slot}', 9200 + slot, 1
        elif slot < 10:
            src, dst, amount, label = f'S{pattern}-{slot}', f'H{pattern}', 2500, 1
        elif slot == 10:
            src, dst, amount, label = f'H{pattern}', f'X{pattern}', 18000, 1
        elif slot == 11:
            amount, label = 30000, 1
        rows.append({'Timestamp': (base + timedelta(seconds=i * 30)).isoformat(),
                     'From Bank': '001', 'Account': src, 'To Bank': '001', 'Account.1': dst,
                     'Amount Received': amount, 'Receiving Currency': 'USD', 'Amount Paid': amount,
                     'Payment Currency': 'USD', 'Payment Format': rng.choice(['ACH', 'Wire', 'Credit Card']),
                     'Is Laundering': label})
    return rows


def normalize(frame: pd.DataFrame) -> list[dict]:
    frame = frame.copy()
    frame.columns = [str(c).strip().lower().replace('.', '_').replace(' ', '_') for c in frame.columns]
    missing = set(REQUIRED) - set(frame.columns)
    if missing:
        raise ValueError(f'Missing CSV columns: {", ".join(sorted(missing))}')
    timestamps = pd.to_datetime(frame.timestamp, errors='coerce', utc=True, format='mixed')
    result, occurrences = [], {}
    for pos, (_, row) in enumerate(frame.iterrows()):
        try:
            stamp = timestamps.iloc[pos]
            if pd.isna(stamp):
                raise ValueError('invalid timestamp')
            for key in REQUIRED[1:]:
                if pd.isna(row[key]) or not str(row[key]).strip():
                    raise ValueError(f'missing {key}')
            paid, received = float(row.amount_paid), float(row.amount_received)
            if not all(math.isfinite(x) and x >= 0 for x in [paid, received]):
                raise ValueError('amounts must be finite and nonnegative')
            label = None
            if 'is_laundering' in row and not pd.isna(row.is_laundering):
                if str(row.is_laundering).strip() not in {'0', '1', '0.0', '1.0'}:
                    raise ValueError('label must be 0 or 1')
                label = int(float(row.is_laundering))
            tx = {'timestamp': stamp.isoformat(), 'sender': f'{row.from_bank}:{row.account}',
                  'receiver': f'{row.to_bank}:{row.account_1}', 'amount': paid,
                  'currency': str(row.payment_currency).upper(), 'amount_received': received,
                  'receiving_currency': str(row.receiving_currency).upper(),
                  'payment_format': str(row.payment_format), 'label': label}
            identity = '|'.join(str(tx[k]) for k in tx if k != 'label')
            occurrences[identity] = occurrences.get(identity, 0) + 1
            tx['id'] = 'TX-' + hashlib.sha256(f'{identity}|{occurrences[identity]}'.encode()).hexdigest()[:20]
            result.append(tx)
        except (ValueError, TypeError) as exc:
            raise ValueError(f'CSV row {pos + 2}: {exc}') from exc
    return sorted(result, key=lambda tx: (tx['timestamp'], tx['id']))


def load_csv(path: str, limit: int = 50000) -> list[dict]:
    if not 1 <= limit <= 100000:
        raise ValueError('AML_LIMIT must be between 1 and 100000')
    # nrows bounds memory even for multi-million-row source files.
    return normalize(pd.read_csv(Path(path), dtype=str, nrows=limit))
