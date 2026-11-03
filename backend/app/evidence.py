"""Canonical ASCII JSON arrays + SHA-256. Arrays avoid object key ordering differences."""
import hashlib
import json


def canonical_evidence(alert: dict, reviewer: str, version: int, previous: str) -> list:
    return ['AML-SENTINEL-V1', alert['id'], [alert['rule_id']], sorted(alert['transaction_ids']),
            alert['detected_at'], alert['status'], reviewer, version, previous]


def canonical_json(payload: list) -> str:
    # ASCII escaping is defined identically in frontend/services/evidence.ts.
    return json.dumps(payload, ensure_ascii=True, separators=(',', ':'))


def evidence_hash(payload: list) -> str:
    return '0x' + hashlib.sha256(canonical_json(payload).encode('ascii')).hexdigest()
