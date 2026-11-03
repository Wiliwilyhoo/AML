import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Fingerprint, Send } from "lucide-react";
import { api } from "../services/api";
import type { Alert, Evidence, GraphData, Status } from "../types";
import {
  Badge,
  Empty,
  ErrorView,
  Loading,
  Network,
  Panel,
  TransactionsTable,
  date,
} from "../components";
import { TransactionDrawer } from "./Transactions";
export default function Investigation({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const { id } = useParams();
  const client = useQueryClient();
  const [reviewer, setReviewer] = useState("Demo Analyst");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState("");
  const query = useQuery({
    queryKey: ["alert", id],
    queryFn: () => api<Alert>("/alerts/" + id),
  });
  const account = query.data?.transactions?.[0]?.sender;
  const graph = useQuery({
    queryKey: ["graph", account],
    queryFn: () =>
      api<GraphData>(
        "/graph?account=" + encodeURIComponent(account!) + "&limit=60",
      ),
    enabled: !!account,
  });
  const mutation = useMutation({
    mutationFn: ({ action, body }: { action: string; body: unknown }) =>
      api("/alerts/" + id + "/" + action, body),
    onSuccess: () => {
      client.invalidateQueries();
      setNote("");
      notify("Investigation updated");
    },
    onError: (e) => notify(e.message),
  });
  const evidence = useMutation({
    mutationFn: () =>
      api<Evidence>("/alerts/" + id + "/evidence", { reviewer }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["alert", id] });
      client.invalidateQueries({ queryKey: ["evidence"] });
      notify(
        "Evidence generated. Open Blockchain Audit to commit with MetaMask.",
      );
    },
    onError: (e) => notify(e.message),
  });
  const select = useCallback((kind: string, id: string) => {
    if (kind === "transaction") setSelected(id);
  }, []);
  const close = useCallback(() => setSelected(""), []);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorView error={query.error} />;
  const a = query.data!;
  const transition = (status: Status) => {
    if (window.confirm(`Move this investigation to ${status}?`))
      mutation.mutate({ action: "review", body: { status, reviewer, note } });
  };
  return (
    <>
      <Link className="back-link" to="/alerts">
        <ArrowLeft size={15} /> Back to alert queue
      </Link>
      <div className="case-heading">
        <div>
          <span className="eyebrow">INVESTIGATION WORKSPACE</span>
          <h2>{a.rule_name}</h2>
          <span className="mono muted">{a.id}</span>
        </div>
        <div className="inline">
          <Badge value={a.severity} />
          <Badge value={a.status} />
        </div>
      </div>
      <div className="grid-wide">
        <Panel title="Alert intelligence" meta={a.rule_id}>
          <div className="detail-content">
            <p>{a.explanation}</p>
            <dl>
              <div>
                <dt>Detected at (source time)</dt>
                <dd>{date(a.detected_at)}</dd>
              </div>
              <div>
                <dt>Risk contribution</dt>
                <dd>
                  {a.risk_score} / 100 · {a.rule_id}
                </dd>
              </div>
              <div>
                <dt>Supporting transactions</dt>
                <dd>{a.transaction_ids.length}</dd>
              </div>
              <div>
                <dt>Assigned reviewer</dt>
                <dd>{a.reviewer || "Unassigned"}</dd>
              </div>
            </dl>
            <p className="fine-print">
              Score is the rule contribution. Transaction scores combine unique
              triggered rule weights, capped at 100. This is not a probability.
            </p>
          </div>
        </Panel>
        <Panel title="Review actions" meta="Application identity">
          <div className="detail-content">
            <label>
              Reviewer
              <input
                disabled={mutation.isPending}
                value={reviewer}
                maxLength={100}
                onChange={(e) => setReviewer(e.target.value)}
              />
            </label>
            <label>
              Investigation note
              <textarea
                disabled={mutation.isPending}
                rows={3}
                value={note}
                maxLength={4000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Document findings and rationale…"
              />
            </label>
            <button
              disabled={!note.trim() || !reviewer.trim() || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  action: "notes",
                  body: { reviewer, text: note },
                })
              }
            >
              <Send size={14} /> Add note
            </button>
            <div className="action-row">
              {a.allowed_statuses?.map((s) => (
                <button
                  className={s === "Under Review" ? "primary" : ""}
                  key={s}
                  disabled={mutation.isPending || !reviewer.trim()}
                  onClick={() => transition(s)}
                >
                  {s === "Under Review" && a.status === "New"
                    ? "Start investigation"
                    : s}
                </button>
              ))}
            </div>
            {!a.allowed_statuses?.length && (
              <p className="muted">
                This case is terminal. Its history remains available.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <Panel
        title="Supporting transactions & account timeline"
        meta="Chronological source activity"
      >
        <TransactionsTable
          rows={[...(a.transactions || [])].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp),
          )}
          onSelect={setSelected}
        />
      </Panel>
      <div className="grid-wide">
        <Panel
          title="Related transaction network"
          meta={
            <Link
              to={"/network?account=" + encodeURIComponent(account || "")}
              className="text-link"
            >
              Open graph explorer →
            </Link>
          }
        >
          {graph.data ? (
            <Network data={graph.data} onSelect={select} />
          ) : (
            <Loading />
          )}
        </Panel>
        <Panel title="Evidence & blockchain" meta={<Fingerprint size={16} />}>
          <div className="detail-content">
            <p>
              Generate a versioned SHA-256 commitment for this review decision.
              Wallet authorization is required separately on-chain.
            </p>
            <button
              className="primary"
              disabled={evidence.isPending || !reviewer.trim()}
              onClick={() => evidence.mutate()}
            >
              <Fingerprint size={15} /> Generate evidence hash
            </button>
            {a.evidence?.map((e) => (
              <div className="evidence-mini" key={e.version}>
                <strong>
                  Version {e.version} · {e.payload[5]}
                </strong>
                <code>{e.hash}</code>
                <small>
                  {e.receipt
                    ? "Client-reported receipt · verify via RPC"
                    : "Off-chain · not committed"}
                </small>
              </div>
            ))}
            <Link className="button" to="/audit">
              Open Blockchain Audit →
            </Link>
          </div>
        </Panel>
      </div>
      <div className="grid-half">
        <Panel title="Investigation notes" meta={a.notes.length + " notes"}>
          {a.notes.length ? (
            a.notes.map((n, i) => (
              <div className="activity" key={i}>
                <div>
                  <strong>{n.reviewer}</strong>
                  <p>{n.text}</p>
                  <small>{date(n.at)}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty>No notes yet.</Empty>
          )}
        </Panel>
        <Panel title="Review history" meta="Session audit log">
          {a.history.length ? (
            a.history.map((h, i) => (
              <div className="activity" key={i}>
                <span className="activity-dot" />
                <div>
                  <strong>
                    {h.from} → {h.to}
                  </strong>
                  <p>
                    {h.note || "Status updated"} · {h.reviewer}
                  </p>
                  <small>{date(h.at)}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty>This alert has not been reviewed.</Empty>
          )}
        </Panel>
      </div>
      {selected && <TransactionDrawer id={selected} onClose={close} />}
    </>
  );
}
