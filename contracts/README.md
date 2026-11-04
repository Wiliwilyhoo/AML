# AMLAuditTrail: Remix and Sepolia

No Hardhat, Truffle or local chain service is required. Contract source is self-contained, SPDX MIT, Solidity `^0.8.20`. Select compiler **0.8.20** in Remix to reproduce the verified build.

The source follows the teaching example's STEP structure: state and mappings, events, constructor, then functions with explicit `require(condition, "message")` checks before state changes and event emission. It records AML evidence and review decisions; it does not receive, withdraw or transfer Ether.

`tests/AMLAuditTrail_test.sol` is optional verification code for Remix Solidity Unit Testing. It checks permissions, duplicate registration, valid/invalid review decisions, and evidence integrity. It is not imported by the main contract, not required to run the app, and must not be selected as the Sepolia deployment contract. Compile and deploy **AMLAuditTrail** from **AMLAuditTrail.sol**.

## Compile and run Remix tests

1. Open https://remix.ethereum.org and create `contracts/AMLAuditTrail.sol`; paste this repository's contract source.
2. Open Solidity Compiler, select **0.8.20**, EVM target **Shanghai**, enable optimization at 200 runs (optional), and compile. Keep these settings recorded for explorer verification.
3. Enable the **Solidity Unit Testing** plugin. Create `contracts/tests/AMLAuditTrail_test.sol` from the repository test file; its relative import must resolve to the source. Remix supplies `remix_tests.sol`.
4. Select the test file and run tests. They cover authorized registration, unauthorized registration/role grant, duplicates, historical hash verification, tampering, valid/invalid reviews, version reuse, grant/revoke and zero inputs.
5. Event assertions use the manual transaction-log checklist below because the Remix Assert library cannot inspect arbitrary emitted receipt logs directly.

## Deploy

In Remix, select compiler **0.8.20**, EVM target **Shanghai**, and contract **AMLAuditTrail** from `AMLAuditTrail.sol`. The constructor has no arguments. Set **VALUE to 0 wei** before clicking Deploy: this contract's constructor is nonpayable. The deploying account pays gas separately; do not enter its gas budget in VALUE. Sending ETH as deployment VALUE will revert.

1. In **Deploy & Run Transactions**, first select a **Remix VM** to practice without real funds.
2. For the actual demo, enable test networks in MetaMask, select **Sepolia**, and fund the intended deployer with test ETH from a trusted faucet.
3. Select **Injected Provider – MetaMask** in Remix. Confirm the chain is **11155111** and the selected address is the intended admin.
4. Select AMLAuditTrail and Deploy, approve the wallet request, and wait for a successful receipt. Record the contract address, deployment transaction and compiler settings.
5. The deployer is admin and initially a reviewer. To use another wallet, call `grantReviewerRole(walletAddress)` from the admin and confirm the transaction. `revokeReviewerRole` removes write access.
6. Remix is an editor/deployment tool; MetaMask's selected RPC/provider connects to the actual Sepolia chain.

## Connect the frontend

From `frontend/`:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_CHAIN_ID=11155111
VITE_RPC_URL=
```

Leave RPC URL empty to use MetaMask for reads, or set a public Sepolia HTTPS RPC URL. Never add a private key, seed phrase or privileged API secret to a Vite variable; it is browser-visible. Restart `npm run dev` after editing. The frontend intentionally accepts Sepolia only.

In Remix Compiler → Compilation Details → ABI, copy the ABI JSON. Replace `frontend/src/abi/AMLAuditTrail.json` with that array if desired. The repository already contains the matching ethers human-readable ABI, including errors and events. Do not use an ABI from a different contract or deployment version.

## Manual chain checklist

- Use `ethers.id("AL-demo")` as a sample bytes32 alert ID; supply any nonzero 32-byte evidence digest and version 1. Register from an authorized reviewer. Expand transaction logs and verify **AlertRegistered** contains exact ID, evidence, version and sender.
- Inspect **ReviewerGranted** in the deployment receipt and in a grant receipt. Switch accounts to test that an ungranted wallet cannot register, update, grant or revoke.
- Register the same key twice: second transaction must revert. Try zero key/hash/version: must revert.
- `getAlert(key)` starts at enum 0 (New); `verifyEvidence(key,1,hash)` returns true, a changed hash false, absent version false, zero hash false.
- Try New → Closed (4): revert. New → UnderReview (1), new hash, version 2: success, **ReviewStatusUpdated** emitted. Original version 1 must still verify.
- Try a reused/non-increasing version, a zero hash, an unregistered key, or a terminal-state transition: revert.
- UnderReview → Escalated (2) → Closed (4) with increasing versions: success. Dismissed (3) and Closed (4) cannot reopen.
- Grant another wallet: **ReviewerGranted** emitted and it can register another key. Revoke it: **ReviewerRevoked** emitted and its next write reverts. Test zero-address grants/revokes.
- In the UI, generate New evidence → Register → approve MetaMask → pending → successful receipt → Verify evidence → Verify receipt via RPC → Test tamper rejection. Then commit a fresh Under Review decision version and verify both historical versions.
- Reject a wallet request and switch to a wrong chain to inspect explicit error states. Avoid intentionally wasting public test ETH on revert transactions when Remix VM suffices.

No real deployment address or successful public transaction is claimed by the repository. Perform these steps with your own wallet and test ETH for the examination.
