import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Fingerprint, Wallet } from "lucide-react";
import { api } from "../services/api";
import {
  address,
  chainId,
  configured,
  connectWallet,
  submitEvidence,
  verifyEvidence,
  verifyReceipt,
  walletError,
} from "../services/web3";
import { hashEvidence } from "../services/evidence";
import type { Evidence } from "../types";
import { Badge, Empty, ErrorView, Loading, Panel, date } from "../components";
export default function Audit({ notify }: { notify: (s: string) => void }) {
  const client = useQueryClient();
  const records = useQuery({
    queryKey: ["evidence"],
    queryFn: () => api<Evidence[]>("/evidence"),
  });
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  useEffect(() => {
    const clear = () => {
      setWallet("");
      setResults({});
      setError(
        "Wallet account or network changed. Reconnect and verify again.",
      );
    };
    window.ethereum?.on?.("accountsChanged", clear);
    window.ethereum?.on?.("chainChanged", clear);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", clear);
      window.ethereum?.removeListener?.("chainChanged", clear);
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(walletError(e));
    } finally {
      setBusy(false);
      setPending("");
    }
  };
  const submit = (e: Evidence, action: "register" | "review") =>
    run(async () => {
      const receipt = await submitEvidence(e, action, setPending);
      await api(`/evidence/${e.alert_id}/${e.version}/receipt`, receipt);
      setResults((r) => ({
        ...r,
        [e.hash]: "Confirmed on-chain · matching audit event and evidence hash",
      }));
      await client.invalidateQueries({ queryKey: ["evidence"] });
      client.invalidateQueries({ queryKey: ["dashboard"] });
      notify("Transaction confirmed and evidence verified on Sepolia.");
    });
  const verify = (e: Evidence, tamper = false) =>
    run(async () => {
      const result = await verifyEvidence(e, tamper);
      setResults((r) => ({
        ...r,
        [e.hash]: tamper
          ? result.valid
            ? "Unexpected tamper match"
            : "Tampered evidence rejected · hash differs from commitment"
          : result.valid
            ? "Evidence matches the on-chain commitment"
            : "No matching commitment for this evidence version",
      }));
    });
  return (
    <>
      <div className={"notice " + (!configured ? "warning" : "")}>
        {configured
          ? "Sepolia configured. Transactions require a wallet with the compliance reviewer role."
          : "Blockchain unconfigured — no on-chain transactions are being simulated. Deploy AMLAuditTrail in Remix, then set frontend/.env and restart Vite."}
      </div>
      <Panel title="Ethereum audit connection" meta={<Wallet size={16} />}>
        <div className="wallet-grid">
          <div>
            <span className="eyebrow">WALLET</span>
            <p className="mono">{wallet || "Not connected"}</p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setWallet((await connectWallet()).address);
                })
              }
            >
              <Wallet size={15} /> Connect MetaMask
            </button>
          </div>
          <div>
            <span className="eyebrow">NETWORK / CHAIN ID</span>
            <p>Ethereum Sepolia · {chainId}</p>
            <Badge value={configured ? "Configured" : "Unconfigured"} />
          </div>
          <div>
            <span className="eyebrow">AUDIT CONTRACT</span>
            <p className="mono wrap">
              {address || "Not deployed / address not supplied"}
            </p>
            {configured && (
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={"https://sepolia.etherscan.io/address/" + address}
              >
                View on Etherscan <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </Panel>
      {error && (
        <div className="notice danger" role="alert">
          {error}
        </div>
      )}
      {pending && (
        <div className="notice">
          Pending transaction · awaiting RPC confirmation.{" "}
          <a
            target="_blank"
            rel="noreferrer"
            href={"https://sepolia.etherscan.io/tx/" + pending}
          >
            {pending}
          </a>
        </div>
      )}
      <Panel
        title="Versioned evidence registry"
        meta={
          <>
            <Fingerprint size={14} /> Hash-only commitments
          </>
        }
      >
        {records.isPending ? (
          <Loading />
        ) : records.error ? (
          <ErrorView error={records.error} />
        ) : !records.data?.length ? (
          <Empty>
            Generate evidence in an investigation to create an off-chain record.
          </Empty>
        ) : (
          <div className="evidence-list">
            {records.data.map((e) => (
              <article className="evidence-card" key={e.hash}>
                <div className="panel-heading">
                  <h3>
                    {e.alert_id} <span className="muted">/ v{e.version}</span>
                  </h3>
                  <Badge value={e.payload[5]} />
                </div>
                <dl>
                  <div>
                    <dt>Evidence SHA-256</dt>
                    <dd className="mono wrap">{e.hash}</dd>
                  </div>
                  <div>
                    <dt>Local integrity</dt>
                    <dd>
                      {hashEvidence(e.payload) === e.hash
                        ? "Canonical hash matches"
                        : "HASH MISMATCH"}
                    </dd>
                  </div>
                  <div>
                    <dt>Reviewer / generated</dt>
                    <dd>
                      {e.payload[6]} · {date(e.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt>Receipt metadata</dt>
                    <dd>
                      {e.receipt
                        ? "Client-reported · verify via RPC"
                        : "Off-chain only"}
                    </dd>
                  </div>
                  {e.receipt && (
                    <>
                      <div>
                        <dt>Transaction</dt>
                        <dd>
                          <a
                            className="text-link mono wrap"
                            target="_blank"
                            rel="noreferrer"
                            href={
                              "https://sepolia.etherscan.io/tx/" +
                              e.receipt.transaction_hash
                            }
                          >
                            {e.receipt.transaction_hash}{" "}
                            <ExternalLink size={12} />
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt>Block / reported gas / time</dt>
                        <dd>
                          {e.receipt.block_number} / {e.receipt.gas_used} /{" "}
                          {e.receipt.confirmation_seconds.toFixed(1)} s
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                <details>
                  <summary>Canonical evidence payload</summary>
                  <pre>{e.canonical}</pre>
                </details>
                <div className="action-row">
                  <button
                    className="primary"
                    disabled={
                      !configured ||
                      busy ||
                      !!e.receipt ||
                      e.payload[5] !== "New"
                    }
                    onClick={() => submit(e, "register")}
                  >
                    Register alert evidence
                  </button>
                  <button
                    disabled={
                      !configured ||
                      busy ||
                      !!e.receipt ||
                      e.payload[5] === "New"
                    }
                    onClick={() => submit(e, "review")}
                  >
                    Record review decision
                  </button>
                  <button
                    disabled={!configured || busy}
                    onClick={() => verify(e)}
                  >
                    Verify evidence hash
                  </button>
                  <button
                    disabled={!configured || busy}
                    onClick={() => verify(e, true)}
                  >
                    Test tamper rejection
                  </button>
                  {e.receipt && (
                    <button
                      disabled={!configured || busy}
                      onClick={() =>
                        run(async () => {
                          const r = await verifyReceipt(e);
                          setResults((v) => ({
                            ...v,
                            [e.hash]: `RPC verified matching event · block ${r.block} · gas ${r.gas}`,
                          }));
                        })
                      }
                    >
                      Verify receipt via RPC
                    </button>
                  )}
                </div>
                {results[e.hash] && (
                  <p className="notice" role="status">
                    {results[e.hash]}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      <p className="fine-print">
        Register evidence while an alert is New, then generate and commit a
        fresh version after each review transition. The contract enforces its
        own transition order. Application reviewer names grant no blockchain
        permissions. Never submit private transaction data on-chain.
      </p>
    </>
  );
}
