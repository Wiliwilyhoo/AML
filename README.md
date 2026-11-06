# AML Sentinel

A working university demonstration of blockchain-enabled AML monitoring. React/TypeScript/Vite, FastAPI/Pandas, six explainable rules, in-memory investigations, timestamp-aware WebSocket replay, ECharts, Cytoscape, and a hash-only Solidity audit trail. Original light interface with an orange accent; no third-party logos or branding.

## Run on Windows PowerShell

Install Python 3.12+ and Node.js 22 LTS. Open two terminals in this repository. No database, Docker, Hardhat, private keys, or paid services are needed for the off-chain demo.

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --env-file .env --reload --host 127.0.0.1 --port 8000
```

Frontend, in the second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**. Vite proxies `/api` and `/ws` to port 8000. Use **one backend worker**. The backend reads dataset settings from `backend/.env`; copy `.env.example` to `.env` for a fresh setup. With `AML_CSV` empty, it generates 3,000 deterministic synthetic transfers.

If script execution is restricted, use `.venv\Scripts\python.exe -m pip ...` and `.venv\Scripts\python.exe -m uvicorn ...` without activating; use `npm.cmd` in place of `npm`. If your managed network requires enterprise certificates, configure its trusted CA or use Node's `--use-system-ca`; do not disable certificate verification.

## Dataset selection

Generate a reproducible CSV from the repository root (with backend dependencies available):

```powershell
python scripts/generate_sample_data.py --rows 3000 --seed 19
```

The default 2% suspicious rate can be changed with `--suspicious-rate`. Use `--rows 20000 --output data/sample/transactions_20000.csv` for a larger evaluation file.

Download IBM Transactions for Anti-Money Laundering from [Kaggle](https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml), subject to its terms. Place a transaction CSV in `data/raw/`, then restart the backend from `backend/`:

```powershell
$env:AML_CSV = "..\data\raw\HI-Small_Trans.csv"
$env:AML_LIMIT = "50000"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use `AML_LIMIT=100000` for a larger bounded subset. This imports the first N rows, then sorts that subset chronologically; it does not sort or read the entire source file. For generated CSV use `..\data\sample\transactions.csv`. Set `AML_CSV` empty to restore built-in samples. The backend command with `--env-file .env` loads `backend/.env`; existing PowerShell environment variables take precedence. Frontend Vite loads `frontend/.env`.

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

# Rule
phát hiện dấu hiệu bằng 6 quy tắc, dựa trên số tiền, tần suất và quan hệ chuyển tiền. Các ngưỡng mặc định như sau:
Quy tắc	Điều kiện đánh dấu	Điểm
Giá trị lớn — HV	Một giao dịch có số tiền lớn hơn 10.000	30
Tần suất cao — VEL	Một tài khoản gửi từ 6 giao dịch trong 60 phút	25
Chia nhỏ tiền — STR	Một tài khoản gửi từ 3 giao dịch, mỗi giao dịch từ 8.000 đến dưới 10.000, trong 60 phút	35
Gom tiền — FIN	Từ 4 tài khoản gửi khác nhau chuyển vào cùng một tài khoản trong 60 phút	30
Phân tán tiền — FOUT	Một tài khoản chuyển tới từ 4 tài khoản nhận khác nhau trong 60 phút	30
Chuyển tiếp nhanh — RAP	Một tài khoản vừa nhận tiền, sau đó chuyển tiền đi trong 10 phút	35


Các quy tắc xét theo từng loại tiền. Ví dụ, 10.000 là 10.000 đơn vị tiền của giao dịch, không phải mặc định 10.000 ETH. Quy tắc chuyển tiếp nhanh hiện chỉ xét thời gian nhận và gửi, chưa đối chiếu số tiền chuyển tiếp.

Điểm rủi ro của giao dịch bằng tổng điểm các quy tắc khác nhau mà nó tham gia, tối đa 100. Một quy tắc kích hoạt nhiều lần không bị cộng lặp.

Ví dụ: tài khoản gửi 4 khoản, mỗi khoản 9.000 USD tới 4 người khác nhau trong một giờ → các khoản này có thể cùng bị đánh dấu chia nhỏ tiền + phân tán tiền = 65 điểm.
Điểm	Mức rủi ro
Dưới 25	Thấp
25–49	Trung bình
50–74	Cao
75–100	Nghiêm trọng


Tài khoản rủi ro cao trên dashboard hiện được tính khi nó là bên gửi hoặc nhận của ít nhất một giao dịch đạt 50 điểm trở lên. Chưa có mô hình chấm điểm riêng cho từng tài khoản.

Đây là dấu hiệu cần điều tra, chưa phải kết luận rửa tiền. Các ngưỡng là cấu hình demo, có thể chỉnh trong Rule Configuration. Cột Is Laundering của Kaggle chỉ dùng để đánh giá độ chính xác; smart contract lưu bằng chứng và trạng thái xử lý, còn backend thực hiện phát hiện.

# Workflow
Blockchain trong project này dùng để lưu dấu bằng chứng và lịch sử xử lý cảnh báo, giúp kiểm tra dữ liệu có bị thay đổi sau khi ghi nhận hay không.

Luồng hoạt động:
1. Backend phát hiện giao dịch đáng ngờ bằng các quy tắc AML.
2. Người kiểm tra mở cảnh báo và tạo bằng chứng gồm mã cảnh báo, các giao dịch liên quan, quy tắc bị kích hoạt, trạng thái và ghi chú.
3. Hệ thống tạo mã băm SHA-256 đại diện cho bằng chứng.
4. Người có quyền reviewer dùng MetaMask ký giao dịch, gửi mã băm lên contract trên Ethereum Sepolia.
5. Contract lưu mã băm theo từng phiên bản, trạng thái xử lý và thông tin người thực hiện. Khi kiểm tra lại, web băm bằng chứng hiện tại rồi so sánh với mã đã lưu.
Ví dụ: bạn ghi nhận bằng chứng có ghi chú “Cần điều tra”, rồi gửi hash lên blockchain. Sau đó ghi chú bị sửa thành “Đã xác minh hợp lệ” thì hash tính lại sẽ khác → web phát hiện bằng chứng hiện tại không khớp bản đã ghi nhận. Nếu cập nhật hợp lệ, cần tạo và ghi nhận phiên bản mới.

Dữ liệu giao dịch và nội dung ghi chú không được đưa trực tiếp lên blockchain, chỉ lưu hash và thông tin kiểm toán. Contract cũng kiểm soát quyền reviewer và thứ tự chuyển trạng thái hồ sơ.

Một giới hạn hiện tại: nội dung bằng chứng nằm trong bộ nhớ backend, sẽ mất khi khởi động lại. Hash trên blockchain vẫn còn, nhưng cần giữ bản bằng chứng gốc để đối chiếu. Blockchain chứng minh bản ghi có khớp hay không; kết luận rửa tiền vẫn cần người điều tra đánh giá.
