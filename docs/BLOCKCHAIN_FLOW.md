# Evidence and blockchain flow

The backend builds this array, in exactly this order:

```text
["AML-SENTINEL-V1", alertId, [ruleId], sortedSupportingTransactionIds,
 detectionTimestampUTC, reviewStatus, reviewerIdentity, evidenceVersion, previousEvidenceHash]
```

Strings are JSON escaped, all characters U+007F and above use lowercase `\uXXXX` escapes (supplementary characters use surrogate pairs), arrays have no whitespace, integers have ordinary decimal notation, and the result has no trailing newline. There are no floating point amounts or unordered objects in the payload. Python uses `json.dumps(ensure_ascii=True, separators=(',', ':'))`. JavaScript uses `JSON.stringify` plus ASCII escaping. SHA-256 hashes the resulting ASCII bytes, represented as `0x` plus 64 lowercase hex digits. `services/evidence.test.ts` contains a shared non-ASCII fixture checked against Python.

The first version references the all-zero bytes32 previous hash; later versions reference the preceding off-chain version. Each generation freezes its payload. Notes and raw financial records are not part of this minimal evidence schema and never go on-chain. The UI exposes canonical bytes for copying; retain those externally before server restart if needed. Hashes commit to the supplied facts, not to the truth of a criminal allegation.

Contract keys are `ethers.id(alertId)` = Keccak-256 of the UTF-8 internal alert ID. The **evidence** digest is SHA-256, not Keccak. Only these bytes32 keys, evidence hashes, versions, status, wallet address, and block timestamp are recorded. Versioned hashes cannot be overwritten; historical versions remain verifiable even after later review updates. Gaps in off-chain versions are allowed, but on-chain update versions must strictly increase.

1. In a **New** alert, generate evidence for New.
2. Connect MetaMask to Sepolia and register using the deployed admin/reviewer wallet. Solidity checks the role and duplicate key.
3. ethers waits for a successful receipt with at least one block confirmation. Until then, the UI says pending.
4. Read the stored version hash and call `verifyEvidence`; only a matching commitment produces a confirmed UI result.
5. The frontend stores the receipt metadata in memory as **client-reported**. A posted API receipt alone is never treated as independently verified.
6. Update the off-chain case to Under Review, generate a new evidence version, then use Record review decision. Continue committing each decision in the contract's transition order.
7. Verify receipt via RPC checks successful status, target address, a matching alert/hash/version event and current stored evidence.
8. Verify evidence compares recomputed canonical bytes with stored commitment. Test tamper rejection changes the reviewer string locally and should fail, without submitting any chain transaction.

The registration function initializes contract status New. It accepts any nonzero evidence version so unused drafts need not be committed. The frontend only permits New payloads for registration. If off-chain status advanced too far before registration, choose an earlier New version or another New case. If the contract is already registered, reuse its existing registry and commit the next permitted decision; do not attempt to register again.

Application reviewer strings are descriptive. Only actual wallet addresses in the contract's reviewer mapping can write. The immutable deployer is the only administrator and can grant/revoke reviewer addresses. Admin rights alone do not bypass reviewer revocation. The contract has no external calls, value transfers or private-key storage.

Wallet errors explicitly report missing MetaMask, rejected requests, wrong network, missing contract bytecode, insufficient test ETH, reverts and RPC failures. Account/network changes clear local verified UI results. The frontend never claims mocked confirmations. Tests of the off-chain workflow do not replace a real Remix deployment or live MetaMask approval.
