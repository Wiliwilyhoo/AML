const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const qaRequire = createRequire(path.join(root, ".tmp", "qa", "package.json"));
const frontendRequire = createRequire(path.join(root, "frontend", "package.json"));
const solc = qaRequire("solc");
const ganache = qaRequire("ganache");
const { BrowserProvider, ContractFactory, id, ZeroHash } = frontendRequire("ethers");

const API = process.env.AML_API || "http://127.0.0.1:8000/api";
const Status = { New: 0, UnderReview: 1, Escalated: 2, Dismissed: 3, Closed: 4 };
const hash = (label) => id(`evidence:${label}`);
const results = [];
const gas = {};

function compile() {
  const source = fs.readFileSync(path.join(root, "contracts", "AMLAuditTrail.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "AMLAuditTrail.sol": { content: source } },
    settings: {
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((item) => item.severity === "error");
  if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
  return output.contracts["AMLAuditTrail.sol"].AMLAuditTrail;
}

function record(name, receipt) {
  gas[name] = gas[name] || [];
  gas[name].push(receipt.gasUsed);
}

async function send(name, call) {
  const tx = await call;
  const receipt = await tx.wait();
  record(name, receipt);
  return receipt;
}

function eventsOf(contract, receipt) {
  return receipt.logs.map((log) => contract.interface.parseLog(log));
}

async function reverts(call, message) {
  await assert.rejects(call, (error) => {
    const text = `${error.reason || ""} ${error.message || ""} ${JSON.stringify(error.info || {})}`;
    assert.ok(text.includes(message), `expected "${message}", received: ${text}`);
    return true;
  });
}

async function check(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}

async function request(route, body) {
  const response = await fetch(`${API}${route}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${route} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function abiNames() {
  const module = await import(pathToFileURL(path.join(root, "frontend", "src", "contract.js")));
  return module.CONTRACT_ABI.map((item) => `${item.type}:${item.name || ""}`).sort();
}

async function main() {
  const artifact = compile();
  const provider = new BrowserProvider(
    ganache.provider({
      logging: { quiet: true },
      wallet: { totalAccounts: 3, deterministic: true },
      chain: { hardfork: "shanghai", vmErrorsOnRPCResponse: true },
    }),
  );
  const [admin, reviewer, outsider] = await Promise.all([0, 1, 2].map((index) => provider.getSigner(index)));
  const factory = new ContractFactory(artifact.abi, artifact.evm.bytecode.object, admin);
  const deployed = await factory.deploy();
  const deployReceipt = await deployed.deploymentTransaction().wait();
  record("deploy", deployReceipt);
  const trail = deployed.connect(admin);
  let counter = 0;
  const nextAlert = () => id(`alert:${(counter += 1)}`);
  const register = async () => {
    const alertId = nextAlert();
    await send("registerAlert", trail.registerAlert(alertId, hash("v1"), 1));
    return alertId;
  };

  await check("bundled frontend ABI matches the compiled contract", async () => {
    const compiled = artifact.abi.map((item) => `${item.type}:${item.name || ""}`).sort();
    assert.deepEqual(await abiNames(), compiled);
  });

  await check("deployment emits ReviewerGranted for the admin", async () => {
    const [event] = eventsOf(trail, deployReceipt);
    assert.equal(event.name, "ReviewerGranted");
    assert.equal(event.args.reviewer, await admin.getAddress());
  });

  await check("registration stores the alert and emits AlertRegistered", async () => {
    const alertId = nextAlert();
    const receipt = await send("registerAlert", trail.registerAlert(alertId, hash("v1"), 1));
    const [event] = eventsOf(trail, receipt);
    assert.equal(event.name, "AlertRegistered");
    assert.deepEqual([event.args.alertId, event.args.evidenceHash, event.args.version], [alertId, hash("v1"), 1n]);
    assert.equal(event.args.reviewer, await admin.getAddress());
    assert.equal((await trail.getAlert(alertId)).status, BigInt(Status.New));
  });

  await check("invalid registrations revert with their messages", async () => {
    await reverts(trail.registerAlert(ZeroHash, hash("v1"), 1), "Invalid alert ID");
    await reverts(trail.registerAlert(nextAlert(), ZeroHash, 1), "Evidence hash cannot be zero");
    await reverts(trail.registerAlert(nextAlert(), hash("v1"), 0), "Evidence version must be greater than zero");
    const alertId = await register();
    await reverts(trail.registerAlert(alertId, hash("v2"), 2), "Alert already registered");
  });

  await check("only reviewers and the admin can write", async () => {
    const alertId = await register();
    const stranger = trail.connect(outsider);
    await reverts(stranger.registerAlert(nextAlert(), hash("v1"), 1), "Only authorized reviewers can register alerts");
    await reverts(
      stranger.updateReviewStatus(alertId, Status.UnderReview, hash("v2"), 2),
      "Only authorized reviewers can update reviews",
    );
    await reverts(stranger.grantReviewerRole(await outsider.getAddress()), "Only admin can grant reviewer role");
    await reverts(stranger.revokeReviewerRole(await admin.getAddress()), "Only admin can revoke reviewer role");
  });

  await check("role changes emit events and take effect", async () => {
    const wallet = await reviewer.getAddress();
    const granted = await send("grantReviewerRole", trail.grantReviewerRole(wallet));
    assert.equal(eventsOf(trail, granted)[0].name, "ReviewerGranted");
    await send("registerAlert", trail.connect(reviewer).registerAlert(nextAlert(), hash("v1"), 1));
    const revoked = await send("revokeReviewerRole", trail.revokeReviewerRole(wallet));
    assert.equal(eventsOf(trail, revoked)[0].name, "ReviewerRevoked");
    await reverts(
      trail.connect(reviewer).registerAlert(nextAlert(), hash("v1"), 1),
      "Only authorized reviewers can register alerts",
    );
  });

  await check("review transitions follow the workflow and emit events", async () => {
    const alertId = await register();
    await reverts(trail.updateReviewStatus(alertId, Status.Closed, hash("v2"), 2), "Invalid review status transition");
    const receipt = await send(
      "updateReviewStatus",
      trail.updateReviewStatus(alertId, Status.UnderReview, hash("v2"), 2),
    );
    const [event] = eventsOf(trail, receipt);
    assert.equal(event.name, "ReviewStatusUpdated");
    assert.deepEqual([event.args.status, event.args.version], [BigInt(Status.UnderReview), 2n]);
    await send("updateReviewStatus", trail.updateReviewStatus(alertId, Status.Escalated, hash("v3"), 3));
    await send("updateReviewStatus", trail.updateReviewStatus(alertId, Status.Closed, hash("v4"), 4));
    await reverts(
      trail.updateReviewStatus(alertId, Status.UnderReview, hash("v5"), 5),
      "Invalid review status transition",
    );
  });

  await check("reverted updates leave state and evidence unchanged", async () => {
    const alertId = await register();
    await reverts(trail.updateReviewStatus(alertId, Status.UnderReview, hash("x"), 1), "Evidence version must increase");
    await reverts(trail.updateReviewStatus(alertId, Status.UnderReview, ZeroHash, 2), "Evidence hash cannot be zero");
    await reverts(trail.updateReviewStatus(nextAlert(), Status.UnderReview, hash("x"), 2), "Alert is not registered");
    const stored = await trail.getAlert(alertId);
    assert.deepEqual([stored.status, stored.version], [BigInt(Status.New), 1n]);
    assert.equal(await trail.getEvidenceHash(alertId, 1), hash("v1"));
    assert.equal(await trail.getEvidenceHash(alertId, 2), ZeroHash);
  });

  await check("historical evidence verifies and tampering is rejected", async () => {
    const alertId = await register();
    await send("updateReviewStatus", trail.updateReviewStatus(alertId, Status.UnderReview, hash("v2"), 2));
    assert.equal(await trail.verifyEvidence(alertId, 1, hash("v1")), true);
    assert.equal(await trail.verifyEvidence(alertId, 2, hash("v2")), true);
    assert.equal(await trail.verifyEvidence(alertId, 1, hash("v2")), false);
    assert.equal(await trail.verifyEvidence(alertId, 3, hash("v1")), false);
    assert.equal(await trail.verifyEvidence(alertId, 1, ZeroHash), false);
  });

  if (process.argv.includes("--api")) {
    await check("backend evidence registers and verifies on the local EVM", async () => {
      const page = await request("/alerts?status=New&page=1&page_size=1");
      const [alert] = page.items;
      assert.ok(alert, "backend has no New alert");
      const first = await request(`/alerts/${alert.id}/evidence`, { reviewer: "check_contract" });
      const alertKey = id(alert.id);
      await send("registerAlert", trail.registerAlert(alertKey, first.hash, first.version));
      assert.equal(await trail.verifyEvidence(alertKey, first.version, first.hash), true);
      await request(`/alerts/${alert.id}/review`, { status: "Under Review", reviewer: "check_contract" });
      const second = await request(`/alerts/${alert.id}/evidence`, { reviewer: "check_contract" });
      await send(
        "updateReviewStatus",
        trail.updateReviewStatus(alertKey, Status.UnderReview, second.hash, second.version),
      );
      assert.equal(await trail.verifyEvidence(alertKey, second.version, second.hash), true);
      assert.equal(await trail.verifyEvidence(alertKey, first.version, second.hash), false);
    });
  }

  await provider.provider?.disconnect?.();

  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}${result.error ? `\n      ${result.error}` : ""}`);
  }
  const failed = results.filter((result) => !result.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed\n`);
  console.log("Gas used on the local EVM");
  for (const [name, values] of Object.entries(gas)) {
    const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    console.log(`${name.padEnd(20)} min ${sorted[0]}  max ${sorted.at(-1)}  samples ${sorted.length}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
