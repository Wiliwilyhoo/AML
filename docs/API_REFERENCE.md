# API reference

Base: `http://127.0.0.1:8000/api`. Interactive schemas are generated at `/docs` and `/openapi.json`. Bodies are JSON. Invalid input returns 422; missing records 404; illegal state transitions and hash mismatches 409. Uncaught errors log details on the server and return a generic 500.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Source and volatile storage status |
| GET | `/dashboard?hours=0` | Actual computed KPIs, charts, case activity and transaction-level evaluation; hours relative to newest loaded source time |
| GET | `/transactions` | Search `q`, ISO timezone-aware `start/end`, `min_amount/max_amount`, `payment_format`, `risk_level`, `suspicious`, `sort`, `descending`, `page`, `page_size` |
| GET | `/transactions/{id}` | Transaction, linked alerts and up to 50 related transfers |
| GET | `/alerts` | `q`, `status`, `severity`, `rule_id`, `sort`, `descending`, pagination |
| GET | `/alerts/{id}` | Case, supporting transactions, notes/history, allowed transitions and evidence versions |
| POST | `/alerts/{id}/review` | `{ "status":"Under Review", "reviewer":"Demo Analyst", "note":"Investigating" }` |
| POST | `/alerts/{id}/notes` | `{ "reviewer":"Demo Analyst", "text":"Reviewed paths" }` |
| GET | `/rules` | Descriptions, weights and active config |
| PUT | `/rules` | Full config from GET; validates, reruns active prefix and retains surviving investigations |
| GET | `/graph` | `account`, `hops` 1–3, `limit` 1–200, `start/end`, `min_amount`, `risk_level`; Cytoscape elements |
| GET | `/replay` | Mode, cursor, speed, total, running flag |
| POST | `/replay` | `{ "action":"start", "speed":300 }`; actions start/pause/resume/reset/speed, speed 1–3600 |
| POST | `/alerts/{id}/evidence` | `{ "reviewer":"Demo Analyst" }`; immutable new payload version, previous hash, canonical bytes and SHA-256 |
| GET | `/evidence` | All session evidence versions, including archived alert contexts |
| POST | `/evidence/{alertId}/{version}/receipt` | Client-reported `{evidence_hash,transaction_hash,block_number,gas_used,confirmation_seconds,action}`; does not independently prove confirmation |

Paginated responses: `{items: [...], total: 123, page: 1, page_size: 25}`. Transaction sorts: timestamp, amount, risk_score, id. Alert sorts: detected_at, risk_score, status, id. `descending` defaults true. Date ranges use inclusive boundaries. Monetary sorting compares nominal source amounts; filter currency-aware results using the provided row currency when interpreting them.

WebSocket: `ws://127.0.0.1:8000/ws/live`. Sends `connected` followed by `replay` updates containing `cursor`, `total`, `running`, `mode`, `speed`, `revision`, and `new_alerts`. No private source records are broadcast. The frontend reloads visible paginated data and aggregates on updates. Slow/disconnected clients are dropped; the frontend retries every three seconds.
