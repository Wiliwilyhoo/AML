import { sha256, toUtf8Bytes } from "ethers";
import type { EvidencePayload } from "../types";
export function canonical(payload: EvidencePayload): string {
  return JSON.stringify(payload).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
export function hashEvidence(payload: EvidencePayload): string {
  return sha256(toUtf8Bytes(canonical(payload)));
}
