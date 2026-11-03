# CSV data

Raw IBM data is not bundled. Obtain it from the [IBM AML dataset reference](https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml), respecting its license, and place the file in `raw/`. Generated sample data lives in `sample/` and is reproducible with seed 19.

| Column | Type / semantics |
| --- | --- |
| Timestamp | Parseable date/time; naive IBM timestamps are interpreted as UTC; aware timestamps converted to UTC |
| From Bank | Required string; leading zeros preserved |
| Account | Required sender identifier string |
| To Bank | Required string |
| Account.1 | Required receiver identifier string |
| Amount Received | Finite nonnegative number |
| Receiving Currency | Required string; uppercased |
| Amount Paid | Finite nonnegative number; detection amount |
| Payment Currency | Required string; uppercased; detection currency |
| Payment Format | Required string, e.g. ACH, Wire, Credit Card |
| Is Laundering | Optional 0/1; empty means unknown, used only for evaluation |

Column names are trimmed, lowercased, with spaces and periods normalized to underscores; normalized forms such as `account_1` also work. A missing required column or invalid required cell rejects the import with a row-specific error instead of silently dropping financial records. Missing labels stay unknown and are excluded from classification metrics. No imputation of account, amount or timestamp is performed.

Accounts are represented as `bank:account`, preventing identical account strings at different banks from merging. An internal transaction ID is the first 20 hex characters of SHA-256 of normalized financial fields plus an identical-row occurrence counter. Evaluation labels are excluded from identity. IDs remain stable for the same ordered input/subset; identical duplicate rows receive separate deterministic IDs. Internal IDs are generated even when a source has its own identifier, providing one consistent format.

The loader reads only the first `AML_LIMIT` rows with Pandas `nrows` (default 50,000, ceiling 100,000), preserving account strings and sorting that bounded subset by UTC timestamp and ID. It does not scan a multi-million-row file into memory. Select a representative chronologically appropriate CSV subset for exam evaluation; the first N rows need not be representative of the full dataset.

Amounts are not converted between currencies. Volume totals and chart series are grouped by source currency. Rule thresholds are nominal demo values applied separately to each currency; historical windows do not combine currencies. Labels in sample files mark planted high-value, structuring, fan-in and fund-movement scenarios. Detection need not reproduce them exactly: legitimate-looking activity can also trigger heuristic signals.
