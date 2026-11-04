import { describe, expect, it, vi } from "vitest";
import { canonical, hashEvidence } from "./evidence";
import { params } from "./api";
import { address, walletError, connectWallet } from "./web3";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contract.js";
import { Interface, isAddress } from "ethers";
import type { EvidencePayload } from "../types";
describe("Evidence trust boundary", () => {
  it("uses the supplied contract configuration and audit methods", () => {
    expect(address).toBe(import.meta.env.VITE_CONTRACT_ADDRESS || CONTRACT_ADDRESS);
    expect(isAddress(address)).toBe(true);
    const abi = new Interface(CONTRACT_ABI);
    for (const name of ["registerAlert", "updateReviewStatus", "getEvidenceHash", "verifyEvidence"])
      expect(abi.getFunction(name)).not.toBeNull();
  });
  const payload: EvidencePayload = [
    "AML-SENTINEL-V1",
    "AL-test",
    ["HV"],
    ["TX-1"],
    "2025-01-06T00:00:00+00:00",
    "New",
    "Nguyễn 😀",
    1,
    "0x" + "0".repeat(64),
  ];
  it("matches the Python ASCII serialization and SHA-256 fixture", () => {
    expect(canonical(payload)).toContain("Nguy\\u1ec5n \\ud83d\\ude00");
    expect(hashEvidence(payload)).toBe(
      "0x8672406ab593d5df4a673d6a04f3623ded1e6342506e569e8b95e2ac41953bee",
    );
  });
  it("detects a changed decision", () => {
    const tampered = structuredClone(payload);
    tampered[5] = "Dismissed";
    expect(hashEvidence(tampered)).not.toBe(hashEvidence(payload));
  });
  it("encodes filters without dropping zero and false", () => {
    expect(
      params({
        q: "001:A B",
        min_amount: 0,
        suspicious: false,
        risk_level: "",
      }),
    ).toBe("q=001%3AA+B&min_amount=0&suspicious=false");
  });
  it("reports wallet rejection and insufficient funds", () => {
    expect(walletError({ code: 4001 })).toContain("rejected");
    expect(walletError({ code: "INSUFFICIENT_FUNDS" })).toContain(
      "Sepolia ETH",
    );
  });
  it("reports a missing wallet explicitly", async () => {
    vi.stubGlobal("window", {});
    try {
      await expect(connectWallet()).rejects.toThrow(
        "MetaMask is not installed",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
