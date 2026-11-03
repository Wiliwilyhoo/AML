# AML Sentinel

A working university demonstration of blockchain-enabled AML monitoring. React/TypeScript/Vite, FastAPI/Pandas, six explainable rules, in-memory investigations, timestamp-aware WebSocket replay, ECharts, Cytoscape, and a hash-only Solidity audit trail. Original dark enterprise interface; no Splunk assets or branding.

## Run on Windows PowerShell

Install Python 3.12+ and Node.js 22 LTS. Open two terminals in this repository. No database, Docker, Hardhat, private keys, or paid services are needed for the off-chain demo.

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in the second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**. Vite proxies `/api` and `/ws` to port 8000. Use **one backend worker**. Initial startup automatically generates and detects 3,000 deterministic synthetic transfers; the dashboard needs no CSV download.

If script execution is restricted, use `.venv\Scripts\python.exe -m pip ...` and `.venv\Scripts\python.exe -m uvicorn ...` without activating; use `npm.cmd` in place of `npm`. If your managed network requires enterprise certificates, configure its trusted CA or use Node's `--use-system-ca`; do not disable certificate verification.

## Dataset selection

Generate a reproducible CSV from the repository root (with backend dependencies available):

```powershell
python scripts/generate_sample_data.py --rows 3000 --seed 19
```

Download IBM Transactions for Anti-Money Laundering from [Kaggle](https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml), subject to its terms. Place a transaction CSV in `data/raw/`, then restart the backend from `backend/`:

```powershell
$env:AML_CSV = "..\data\raw\HI-Small_Trans.csv"
$env:AML_LIMIT = "50000"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use `AML_LIMIT=100000` for a larger bounded subset. This imports the first N rows, then sorts that subset chronologically; it does not sort or read the entire source file. For generated CSV use `..\data\sample\transactions.csv`. Remove `AML_CSV` to restore built-in samples. Environment example files are documentation: PowerShell environment variables must be set explicitly; the Python server does not auto-load `.env`. Frontend Vite does load `frontend/.env`.

See [data schema](data/README.md), [architecture](docs/ARCHITECTURE.md), [rules](docs/AML_RULES.md), and [API reference](docs/API_REFERENCE.md).

## Investigations and blockchain

All eight pages use real session data. Transactions have server-side filters, sort and pagination. An alert is its investigation case. Open one from Alert Management, document notes, and transition it through the review workflow. Network views show bounded real transfer relationships. Dashboard time scopes use the newest loaded source timestamp, not today's clock.

Blockchain starts **unconfigured**. Nothing is mocked as a confirmed transaction. Follow [contracts/README.md](contracts/README.md) to compile and test in Remix, deploy to Sepolia using MetaMask, and configure the app. ABI location: `frontend/src/abi/AMLAuditTrail.json`; the bundled human-readable ABI matches the supplied source. [Blockchain flow](docs/BLOCKCHAIN_FLOW.md) defines canonical serialization, roles, confirmations, versioning, and tamper checks.

The easiest chain demonstration: generate **New** evidence, register it, start the investigation, generate **Under Review** evidence, record the decision, verify both versions, then run the tamper test. On-chain and off-chain transitions must be committed in order.

## Replay and session lifecycle

The initial view is a complete static snapshot. **Start** switches to replay and clears loaded transactions, alerts, notes and reviews after confirmation. Historical timestamps advance at 1–3600× real time. Pause/Resume preserves the cursor and cannot ingest IDs twice. WebSockets invalidate live views and show new-alert notifications. **Reset** pauses and returns to an empty replay session; Resume begins processing from the start. Evidence archives are retained within the running process, including when a rule rerun removes an alert. Restart restores the full snapshot and **erases all off-chain state, evidence payloads and receipt metadata**. Save canonical evidence externally before restarting if demonstrating later verification. Existing on-chain records survive and prevent duplicate registration.

## Checks

```powershell
cd backend
python -m unittest discover -s tests -v
cd ..\frontend
npm test
npm run build
```

Backend tests cover validation, CSV IDs, six rules, leakage, deduplication, windows, currency isolation, scores, investigation transitions, API validation, evidence, graph limits, replay and WebSockets. Frontend tests cover computed metrics, filters, detail inspection, notes/status/evidence actions, graph mapping, shared hashing, and wallet errors. React tests mock API responses and chart renderers explicitly; these are not chain confirmations. Remix tests and the manual event checklist are under `contracts/`.

Use `npm run dev` for the integrated local demo. See the [15-minute demo guide](docs/DEMO_GUIDE.md) and [verification notes](docs/VALIDATION.md), including optional local EVM checks.

## Scope and limits

This is a local examination system without application authentication, persistence, calibrated ML, FX conversion, or a real banking feed. Bind to loopback. Blockchain authorization uses actual wallet roles. Rule thresholds are demo parameters applied independently per currency, not legal requirements. Supporting transfers can be flagged retrospectively when a pattern completes; the rule detector never consumes future records. Synthetic labels describe planted patterns, not confirmed criminal activity. Graphs and scores support human review. Real Sepolia deployment, wallet approval and test ETH are manual prerequisites; local tests do not establish a public deployment.
