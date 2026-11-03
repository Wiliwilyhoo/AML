# Verification

The repository has automated backend and frontend tests, plus Remix-compatible Solidity tests. Build and test results below describe local checks, not a public Sepolia deployment.

- Backend: `python -m unittest discover -s tests -v` checks five grouped tests, including full API import-to-case-to-evidence and timestamp-aware WebSocket replay.
- Frontend: `npm test` checks ten assertions/workflow tests across two files. Charts and API responses in component tests are explicit test doubles.
- Production frontend: `npm run build` checks TypeScript and generates Vite static assets.
- Live Chrome QA checks eight pages, computed metrics, scope and server filters, transaction drawer, investigation status/notes/evidence, Cytoscape rendering, unconfigured/missing-wallet errors and a 390px mobile layout. Browser QA does not grant actual wallet permissions.
- Solidity 0.8.20 compiler output is checked against the bundled ethers ABI. An isolated Ganache EVM verifies registration, duplicate prevention, authorization, `require` error messages, status/version checks, historical hashes, events and tamper rejection. Optional API integration uses actual generated Python evidence in the local EVM. None of these receipts are labeled as Sepolia or posted as public confirmations.
- A local 50,000-row synthetic performance check loaded and detected the bounded subset in approximately 13 seconds, with about 1 second in rule execution. Timing depends on the machine and input account density; this is not a benchmark for the full IBM dataset.

## Optional local contract check

The application does not require a local chain. If you want to reproduce the isolated checks rather than use Remix alone, install tooling under the ignored `.tmp/qa` directory from the repository root:

```powershell
npm install --prefix .tmp/qa --no-save solc@0.8.20 ganache@7.9.2
node scripts/check_contract.cjs
# Start the normal backend first for an API-to-local-EVM integration check:
node scripts/check_contract.cjs --api
```

The script uses ethers from `frontend/node_modules`, so install frontend dependencies first. Ganache runs in-process and disconnects at completion; it creates no database or background service. `--api` creates evidence and transitions a New alert in the current in-memory demo. On newer Node versions, Ganache may log that its optional native transport is unavailable and use its JavaScript fallback. This tooling is optional and never part of app startup or Remix deployment.

Remix testing and public-chain wallet interaction still need the manual checklist in [contracts/README.md](../contracts/README.md). Sepolia test ETH, transaction approvals, the deployed address and public-network confirmation are supplied and verified by the presenter.
