import asyncio
import copy
import os
import tempfile
import unittest
from pathlib import Path
import pandas as pd
from fastapi.testclient import TestClient
from app.data import load_csv, normalize, sample_rows
from app.detection import Detector, RULES, severity
from app.evidence import canonical_json, evidence_hash
from app.main import app
from app.models import RuleConfig


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.rows = normalize(pd.DataFrame(sample_rows(120)))

    def test_csv_stability_and_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'sample.csv'
            pd.DataFrame(sample_rows(120)).to_csv(path, index=False)
            self.assertEqual(load_csv(str(path), 40), self.rows[:40])
        for field, invalid in [('Amount Paid', '-1'), ('Timestamp', 'bad'), ('Account', None), ('Amount Paid', 'NaN'), ('Is Laundering', '7')]:
            raw = sample_rows(1)
            raw[0][field] = invalid
            with self.assertRaises(ValueError):
                normalize(pd.DataFrame(raw))
        with self.assertRaises(ValueError):
            normalize(pd.DataFrame({'timestamp': ['bad']}))

    def test_six_rules_deduplication_and_no_label_leakage(self):
        def run(rows):
            detector = Detector(RuleConfig(velocity_count=4))
            alerts = [a for tx in rows for a in detector.process(tx)]
            self.assertEqual(detector.process(rows[-1]), [])
            return alerts
        expected = run(self.rows)
        self.assertEqual({a['rule_id'] for a in expected}, set(RULES))
        self.assertEqual(len({a['id'] for a in expected}), len(expected))
        flipped = [{**x, 'label': 1 - x['label']} for x in self.rows]
        self.assertEqual(expected, run(flipped))
        by_id = {t['id']: t for t in self.rows}
        for alert in expected:
            self.assertTrue(all(by_id[t]['timestamp'] <= alert['detected_at'] for t in alert['transaction_ids']))

    def test_windows_and_currency(self):
        first = self.rows[0]
        detector = Detector(RuleConfig(velocity_count=2))
        detector.process(first)
        later = {**first, 'id': 'later', 'timestamp': '2025-01-07T00:00:00+00:00'}
        self.assertNotIn('VEL', [a['rule_id'] for a in detector.process(later)])
        detector = Detector(RuleConfig(velocity_count=2))
        detector.process(first)
        other = {**first, 'id': 'EUR', 'currency': 'EUR', 'receiving_currency': 'EUR'}
        self.assertNotIn('VEL', [a['rule_id'] for a in detector.process(other)])
        self.assertEqual([severity(x) for x in [0, 25, 50, 75, 100]], ['Low', 'Medium', 'High', 'Critical', 'Critical'])

    def test_evidence_tamper_and_unicode(self):
        payload = ['AML', ['TX-2', 'TX-1'], 'Nguyễn 😀', 1]
        self.assertEqual(canonical_json(payload), '["AML",["TX-2","TX-1"],"Nguy\\u1ec5n \\ud83d\\ude00",1]')
        self.assertEqual(evidence_hash(payload), evidence_hash(copy.deepcopy(payload)))
        altered = copy.deepcopy(payload)
        altered[2] = 'tampered'
        self.assertNotEqual(evidence_hash(payload), evidence_hash(altered))

    def test_end_to_end_api(self):
        os.environ['AML_SAMPLE_SIZE'] = '120'
        with TestClient(app) as client:
            dashboard = client.get('/api/dashboard').json()
            self.assertEqual(dashboard['transactions'], 120)
            self.assertGreater(dashboard['flagged'], 0)
            self.assertLessEqual(client.get('/api/dashboard?hours=1').json()['transactions'], 120)
            self.assertEqual(client.get('/api/transactions?page_size=101').status_code, 422)
            self.assertEqual(client.get('/api/transactions?start=bad').status_code, 422)
            rows = client.get('/api/transactions?min_amount=10000').json()
            self.assertTrue(all(t['amount'] >= 10000 for t in rows['items']))
            aid = client.get('/api/alerts').json()['items'][0]['id']
            self.assertEqual(client.post(f'/api/alerts/{aid}/review', json={'status': 'Closed', 'reviewer': 'Demo'}).status_code, 409)
            for status in ['Under Review', 'Escalated', 'Closed']:
                self.assertEqual(client.post(f'/api/alerts/{aid}/review', json={'status': status, 'reviewer': 'Demo'}).status_code, 200)
            client.post(f'/api/alerts/{aid}/notes', json={'reviewer': 'Demo', 'text': 'Reviewed supporting flows'})
            evidence = client.post(f'/api/alerts/{aid}/evidence', json={'reviewer': 'Nguyễn 😀'}).json()
            self.assertEqual(evidence['hash'], evidence_hash(evidence['payload']))
            second = client.post(f'/api/alerts/{aid}/evidence', json={'reviewer': 'Demo'}).json()
            self.assertEqual(second['payload'][-1], evidence['hash'])
            self.assertEqual(second['version'], 2)
            graph = client.get('/api/graph?limit=10').json()
            self.assertLessEqual(len(graph['edges']), 10)
            node_ids = {n['data']['id'] for n in graph['nodes']}
            self.assertTrue(all(e['data']['source'] in node_ids and e['data']['target'] in node_ids for e in graph['edges']))
            offset = client.get('/api/graph?start=2025-01-06T07:00:00%2B07:00&end=2025-01-06T00:00:00Z').json()
            self.assertTrue(all(app.state.aml.transactions[e['data']['id']]['timestamp'] == '2025-01-06T00:00:00+00:00' for e in offset['edges']))
            for tid, score in app.state.aml.risks.items():
                self.assertEqual(score, min(100, sum(RULES[r][2] for r in app.state.aml.tx_rules[tid])))
            config = client.get('/api/rules').json()['config']
            config['enabled'] = []
            self.assertEqual(client.put('/api/rules', json=config).status_code, 200)
            self.assertEqual(client.get('/api/dashboard').json()['alerts'], 0)
            client.post('/api/replay', json={'action': 'reset', 'speed': 3600})
            self.assertEqual(client.get('/api/dashboard').json()['transactions'], 0)
            self.assertEqual(len(client.get('/api/evidence').json()), 2)
            client.post('/api/replay', json={'action': 'start', 'speed': 3600})
            with client.websocket_connect('/ws/live') as ws:
                self.assertEqual(ws.receive_json()['type'], 'connected')
                event = ws.receive_json()
                self.assertEqual(event['type'], 'replay')
                self.assertGreater(event['cursor'], 0)
            client.post('/api/replay', json={'action': 'pause', 'speed': 3600})
            state = app.state.aml
            self.assertEqual(len(state.transactions), state.cursor)
            client.post('/api/replay', json={'action': 'resume', 'speed': 3600})
            self.assertEqual(len(state.transactions), state.cursor)


if __name__ == '__main__':
    unittest.main()
