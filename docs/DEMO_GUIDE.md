# 15-minute examination demonstration

Before the exam: install dependencies, run automated checks, start backend/frontend, optionally deploy via Remix and configure Sepolia. Keep a reviewer wallet funded with test ETH. Startup loads 3,000 deterministic synthetic records. Explain that state is volatile, the feed is historical replay, thresholds are configurable, and source labels never drive detection.

| Time | Demonstration |
| --- | --- |
| 0:00–2:00 | Security Overview: explain actual transaction counts, per-currency volume, flagged rate, severity distribution, rules and empty review activity. Change scope to last 24 source hours. |
| 2:00–4:00 | Transaction Monitoring: search account/ID, filter amount and flagged status, change sort, page results, open a transfer drawer and inspect linked alerts. |
| 4:00–5:00 | Alert Management: choose a New alert, explain the supporting IDs, source detection time and rule weight. Open its investigation. |
| 5:00–7:00 | Generate New evidence **before changing status**. Open Blockchain Audit, connect MetaMask and register the evidence. Show pending vs confirmed and Etherscan. If unconfigured, explicitly show that no on-chain confirmation exists. |
| 7:00–9:00 | Return to the same investigation, Start investigation, add a rationale note, inspect chronological transfers and graph. Generate Under Review evidence, commit Record review decision. |
| 9:00–10:00 | Verify both versions and receipt via RPC. Show canonical payload and previous hash. Test tamper rejection: altered reviewer bytes no longer match. |
| 10:00–11:00 | Transaction Network: center on an account, adjust hops/min amount, select a node and edge, inspect relationships. Explain that a path is not proof of crime. |
| 11:00–12:00 | Rule Configuration: adjust a threshold or disable one rule, save/rerun, show consistent queue/KPI changes. Surviving case histories remain. |
| 12:00–14:00 | Start historical replay, approve clearing the snapshot. Select 300× or 3600×, watch source-time progress, live alerts and KPIs; pause, resume, then show Reset confirmation. |
| 14:00–15:00 | Evaluation: transaction confusion matrix, precision/recall/F1 and false-positive rate, separate alert counts, measured processing time and client-reported chain costs. Explain synthetic-label and heuristic limitations. |

Refresh preserves server state; backend restart erases it and restores the initial full snapshot. Reset clears cases/notes and reloads from an empty prefix, retaining evidence archives until restart. On-chain records never reset. Do not reuse an already registered deterministic alert ID as if it were new; inspect the existing contract record or deploy a fresh demo contract before rehearsing another chain registration.

For offline presentations, demonstrate the full off-chain workflow and canonical tamper hashing using tests; label chain actions unconfigured. A UI test or mocked response is never proof of a real Sepolia transaction. Allow extra time for RPC delays; a pending transaction must remain pending until a successful receipt and matching stored commitment are read.
