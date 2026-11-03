# Explainable detection rules

Transactions enter in chronological order. Each rule sees only the current record and previously ingested records. Ties are ordered by deterministic internal ID. Incoming-to-outgoing rapid movement requires strictly earlier source time, avoiding an arbitrary ordering inference between simultaneous transfers. Windows include their lower boundary. Context IDs hash the rule and sorted supporting transaction IDs; duplicate ingestion has no effect.

| ID | Trigger | Default parameters | Weight / severity |
| --- | --- | --- | --- |
| HV | Amount paid **above** threshold | 10,000 nominal currency units | 30 / Medium |
| VEL | Outgoing account count **at least** N in window | 6 / 60 minutes | 25 / Medium |
| STR | Repeated outgoing amounts from floor × threshold inclusive to threshold exclusive | 3 / 8,000–9,999.99 / 60 minutes | 35 / Medium |
| FIN | Distinct senders to a destination in window | 4 / 60 minutes | 30 / Medium |
| FOUT | Distinct receivers from a sender in window | 4 / 60 minutes | 30 / Medium |
| RAP | Account receives funds and then sends onward within window | 10 minutes, same received/paid currency | 35 / Medium |

The shared rolling window controls VEL, STR, FIN and FOUT. High-value and structuring thresholds are independent. Rules can be disabled individually. Rapid movement is temporal proximity, not a claim that exact funds are traceable; it does not assert balance matching. Fan-in groups by receiving currency; fan-out and outgoing rules by paid currency. Thresholds are demonstration settings, never universal legal obligations.

An alert reports its rule contribution, supporting IDs, detection source timestamp and explanation. Each `(rule, supporting context)` yields one deterministic alert; an expanding context can create a new alert when another transfer arrives. Multiple alerts for different contexts are intentional. One alert corresponds to one investigation case. Review statuses: New → Under Review or Dismissed; Under Review → Escalated, Dismissed or Closed; Escalated → Under Review or Closed; terminal Dismissed/Closed cannot reopen.

Transaction risk is the sum of **unique** triggered rule weights among all alert contexts supporting that transaction, capped at 100. Repeated contexts do not repeatedly increase the same rule contribution. Low: 0–24; Medium: 25–49; High: 50–74; Critical: 75–100. Individual alerts currently have Medium severity because each contains one rule; aggregate transaction scores can be High/Critical. The overview ranks alerts by contribution and source time and separately charts aggregate transaction severity. No fabricated Critical alerts are inserted.

Earlier transactions can acquire a flag when a later pattern completes. Evaluation uses this final observed-prefix transaction classification, not an assertion that a rule detected the earlier transfer at its original timestamp. Rule execution itself has no look-ahead. `Is Laundering` is stored separately, excluded from IDs and rule code, and consumed only by classification metrics. Unknown labels are omitted. Zero denominators yield unavailable metrics. Precision/recall/F1/FPR/FNR and confusion counts are transaction-level; alert counts and case statuses are separate alert-level operational statistics.

On rerun, surviving context IDs retain notes, assignment and status. Removed contexts leave the active queue, while their generated evidence remains in the session archive. Default counts and windows are intentionally easy to demonstrate; tune against the chosen dataset subset and report false positives rather than treating scores as calibrated probabilities.
