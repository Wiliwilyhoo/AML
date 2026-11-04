import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  getAddress,
  id,
  isAddress,
  type Eip1193Provider,
} from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract.js";
import type { Evidence, Status } from "../types";
import { hashEvidence } from "./evidence";
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, listener: () => void) => void;
      removeListener?: (event: string, listener: () => void) => void;
    };
  }
}
export const address = import.meta.env.VITE_CONTRACT_ADDRESS || CONTRACT_ADDRESS;
export const chainId = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
const statuses: Status[] = [
  "New",
  "Under Review",
  "Escalated",
  "Dismissed",
  "Closed",
];
export const configured = isAddress(address) && chainId === 11155111;
export function walletError(error: unknown): string {
  const e = error as {
    code?: string | number;
    shortMessage?: string;
    message?: string;
    info?: { error?: { code?: number } };
  };
  if (
    e.code === 4001 ||
    e.code === "ACTION_REJECTED" ||
    e.info?.error?.code === 4001
  )
    return "Wallet request rejected. You can retry when ready.";
  if (e.code === "INSUFFICIENT_FUNDS")
    return "Insufficient Sepolia ETH for gas. Fund this wallet with test ETH.";
  if (e.code === "CALL_EXCEPTION")
    return "Contract reverted. Check reviewer role, review transition, version and duplicate registration.";
  return e.shortMessage || e.message || "Wallet or RPC request failed.";
}
export async function connectWallet() {
  if (!window.ethereum)
    throw new Error(
      "MetaMask is not installed. Install MetaMask to connect a wallet.",
    );
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(chainId))
    throw new Error(
      "Wrong network. Switch MetaMask to Ethereum Sepolia (11155111).",
    );
  const signer = await provider.getSigner();
  return {
    provider,
    signer,
    address: await signer.getAddress(),
    chain: Number(network.chainId),
  };
}
async function contract(write = false) {
  if (!configured)
    throw new Error(
      "Blockchain unconfigured. Check contract.js and the Sepolia chain ID.",
    );
  if (write) {
    const wallet = await connectWallet();
    if ((await wallet.provider.getCode(address)) === "0x")
      throw new Error("No contract deployed at this address on Sepolia.");
    return new Contract(getAddress(address), CONTRACT_ABI, wallet.signer);
  }
  const rpc = import.meta.env.VITE_RPC_URL;
  const provider = rpc
    ? new JsonRpcProvider(rpc)
    : window.ethereum
      ? new BrowserProvider(window.ethereum)
      : null;
  if (!provider)
    throw new Error(
      "Connect MetaMask or configure VITE_RPC_URL to verify evidence.",
    );
  if ((await provider.getNetwork()).chainId !== BigInt(chainId))
    throw new Error("Wrong network. Switch to Sepolia.");
  if ((await provider.getCode(address)) === "0x")
    throw new Error("Contract not deployed at configured address.");
  return new Contract(address, CONTRACT_ABI, provider);
}
export async function submitEvidence(
  record: Evidence,
  action: "register" | "review",
  pending: (hash: string) => void,
) {
  if (hashEvidence(record.payload) !== record.hash)
    throw new Error("Local evidence hash mismatch. Submission stopped.");
  if (action === "register" && record.payload[5] !== "New")
    throw new Error(
      "Register New evidence before reviewing. Create a new alert or use an earlier New evidence version.",
    );
  const c = await contract(true);
  const started = performance.now();
  const method = action === "register" ? c.registerAlert : c.updateReviewStatus;
  const args =
    action === "register"
      ? [id(record.alert_id), record.hash, record.version]
      : [
          id(record.alert_id),
          statuses.indexOf(record.payload[5]),
          record.hash,
          record.version,
        ];
  const estimate: bigint = await method.estimateGas(...args);
  const tx = await method(...args, { gasLimit: (estimate * 125n) / 100n });
  pending(tx.hash);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1)
    throw new Error("Transaction reverted or confirmation unavailable.");
  const verification = await verifyEvidence(record);
  if (!verification.valid)
    throw new Error(
      "Receipt confirmed but contract evidence comparison failed.",
    );
  return {
    evidence_hash: record.hash,
    transaction_hash: receipt.hash,
    block_number: receipt.blockNumber,
    gas_used: receipt.gasUsed.toString(),
    confirmation_seconds: (performance.now() - started) / 1000,
    action,
  };
}
export async function verifyEvidence(record: Evidence, tamper = false) {
  const c = await contract();
  const payload = structuredClone(record.payload);
  if (tamper) payload[6] += " [tampered]";
  const hash = hashEvidence(payload);
  const stored: string = await c.getEvidenceHash(
    id(record.alert_id),
    record.version,
  );
  const valid: boolean = await c.verifyEvidence(
    id(record.alert_id),
    record.version,
    hash,
  );
  return {
    valid: valid && stored.toLowerCase() === hash.toLowerCase(),
    stored,
    computed: hash,
  };
}
export async function verifyReceipt(record: Evidence) {
  if (!record.receipt) throw new Error("No transaction receipt recorded.");
  const c = await contract();
  const provider = c.runner!.provider!;
  const receipt = await provider.getTransactionReceipt(
    record.receipt.transaction_hash,
  );
  if (
    !receipt ||
    receipt.status !== 1 ||
    receipt.to?.toLowerCase() !== address.toLowerCase()
  )
    throw new Error(
      "Receipt is pending, reverted, or belongs to another contract.",
    );
  if (
    !receipt.logs.some((log) => {
      try {
        const parsed = c.interface.parseLog(log);
        return (
          log.address.toLowerCase() === address.toLowerCase() &&
          parsed?.args.alertId === id(record.alert_id) &&
          parsed.args.evidenceHash === record.hash &&
          Number(parsed.args.version) === record.version
        );
      } catch {
        return false;
      }
    })
  )
    throw new Error("Receipt has no matching audit event.");
  if (!(await verifyEvidence(record)).valid)
    throw new Error("Stored evidence does not match this version.");
  return { block: receipt.blockNumber, gas: receipt.gasUsed.toString() };
}
