import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, params } from "../services/api";
import type { GraphData, Page, Tx } from "../types";
import {
  Empty,
  ErrorView,
  Loading,
  Network,
  Panel,
  number,
} from "../components";
import { TransactionDrawer } from "./Transactions";
export default function Graph() {
  const [sp] = useSearchParams();
  const [filters, setFilters] = useState({
    account: sp.get("account") || "",
    hops: "1",
    min_amount: "0",
    risk_level: "",
    start: "",
    end: "",
  });
  const [selected, setSelected] = useState({ kind: "", id: "" });
  const query = params({
    ...filters,
    start: filters.start ? new Date(filters.start).toISOString() : undefined,
    end: filters.end ? new Date(filters.end).toISOString() : undefined,
  });
  const graph = useQuery({
    queryKey: ["graph", query],
    queryFn: () => api<GraphData>("/graph?" + query),
  });
  const related = useQuery({
    queryKey: ["transactions", "account", selected.id],
    queryFn: () =>
      api<Page<Tx>>(
        "/transactions?q=" + encodeURIComponent(selected.id) + "&page_size=10",
      ),
    enabled: selected.kind === "account",
  });
  const select = useCallback(
    (kind: string, id: string) => setSelected({ kind, id }),
    [],
  );
  const close = useCallback(() => setSelected({ kind: "", id: "" }), []);
  return (
    <>
      <Panel
        title="Transaction network explorer"
        meta="Directional transfers · up to 200 edges"
      >
        <div className="filters">
          <label className="grow">
            Account
            <input
              placeholder="Leave empty to explore a flagged account"
              value={filters.account}
              onChange={(e) =>
                setFilters({ ...filters, account: e.target.value })
              }
            />
          </label>
          <label>
            Hops
            <select
              value={filters.hops}
              onChange={(e) => setFilters({ ...filters, hops: e.target.value })}
            >
              {[1, 2, 3].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Min amount
            <input
              type="number"
              min="0"
              value={filters.min_amount}
              onChange={(e) =>
                setFilters({ ...filters, min_amount: e.target.value })
              }
            />
          </label>
          <label>
            Risk
            <select
              value={filters.risk_level}
              onChange={(e) =>
                setFilters({ ...filters, risk_level: e.target.value })
              }
            >
              <option value="">All levels</option>
              {["Low", "Medium", "High", "Critical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="datetime-local"
              value={filters.start}
              onChange={(e) =>
                setFilters({ ...filters, start: e.target.value })
              }
            />
          </label>
          <label>
            Until
            <input
              type="datetime-local"
              value={filters.end}
              onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            />
          </label>
        </div>
      </Panel>
      <div className="grid-wide">
        <Panel
          title="Account relationships"
          meta={
            <span className="legend">
              <i className="neutral" /> Account <i className="pink" /> High risk
            </span>
          }
        >
          {graph.isPending ? (
            <Loading />
          ) : graph.error ? (
            <ErrorView error={graph.error} />
          ) : (
            <>
              <Network data={graph.data!} onSelect={select} />
              <div className="graph-footer">
                {number(graph.data!.nodes.length)} accounts ·{" "}
                {number(graph.data!.edges.length)} transfers{" "}
                {graph.data!.limited && "· Limit reached; narrow filters"}
                <span>Scroll to zoom · Drag to pan · Click to inspect</span>
              </div>
            </>
          )}
        </Panel>
        <Panel title="Selection intelligence" meta="Exploratory evidence">
          {selected.kind === "account" ? (
            <div className="detail-content">
              <span className="field-label">Financial account</span>
              <h3 className="mono">{selected.id}</h3>
              <p>
                {related.data?.total || 0} related transfers in the loaded
                session.
              </p>
              <button
                onClick={() => setFilters({ ...filters, account: selected.id })}
              >
                Explore from this account
              </button>
              <Link
                className="button"
                to={"/transactions?q=" + encodeURIComponent(selected.id)}
              >
                View transaction history
              </Link>
              {related.data?.items.map((tx) => (
                <div className="evidence-mini" key={tx.id}>
                  <button
                    className="text-link mono"
                    onClick={() => select("transaction", tx.id)}
                  >
                    {tx.id}
                  </button>
                  <small>
                    {tx.sender} → {tx.receiver}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              Select an account or transfer to inspect its relationships and
              linked alerts.
            </Empty>
          )}
          <p className="fine-print padded">
            Graph relationships and highlighted paths support investigation;
            they do not establish criminal activity.
          </p>
        </Panel>
      </div>
      {selected.kind === "transaction" && (
        <TransactionDrawer id={selected.id} onClose={close} />
      )}
    </>
  );
}
