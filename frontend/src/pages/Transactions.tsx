import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { api, params } from "../services/api";
import type { Page, Tx } from "../types";
import {
  Badge,
  Drawer,
  ErrorView,
  Loading,
  money,
  Pagination,
  Panel,
  TransactionsTable,
} from "../components";
export function TransactionDrawer({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => api<Tx>("/transactions/" + id),
  });
  return (
    <Drawer title="Transaction intelligence" onClose={onClose}>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : (
        <div className="detail-content">
          <h3 className="mono">{q.data!.id}</h3>
          <Badge value={q.data!.risk_level} />
          <p className="large-amount">
            {money(q.data!.amount, q.data!.currency)}
          </p>
          <dl>
            {Object.entries({
              Timestamp: q.data!.timestamp,
              Source: q.data!.sender,
              Destination: q.data!.receiver,
              "Payment format": q.data!.payment_format,
              "Amount received": money(
                q.data!.amount_received,
                q.data!.receiving_currency,
              ),
              "Risk score": q.data!.risk_score + " / 100",
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>Linked alerts</h3>
          {q.data!.alerts?.map((a) => (
            <Link
              className="detail-link"
              key={a.id}
              to={"/investigations/" + a.id}
            >
              {a.rule_name} · {a.id}
            </Link>
          ))}
          <Link
            className="button"
            to={"/network?account=" + encodeURIComponent(q.data!.sender)}
          >
            Explore source account network
          </Link>
          <h3>Related account activity · up to 50 transfers</h3>
          <TransactionsTable rows={q.data!.related || []} />
        </div>
      )}
    </Drawer>
  );
}
export default function Transactions() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [q, setQ] = useState(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    min_amount: "",
    max_amount: "",
    payment_format: "",
    risk_level: "",
    suspicious: "",
    sort: "timestamp",
    descending: "true",
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);
  const close = useCallback(() => setSelected(""), []);
  const query = params({
    ...filters,
    start: filters.start ? new Date(filters.start).toISOString() : undefined,
    end: filters.end ? new Date(filters.end).toISOString() : undefined,
    q,
    page,
  });
  const result = useQuery({
    queryKey: ["transactions", query],
    queryFn: () => api<Page<Tx>>("/transactions?" + query),
  });
  const change = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  return (
    <>
      <Panel
        title="Transaction explorer"
        meta={
          <>
            <SlidersHorizontal size={13} /> Server-side search & pagination
          </>
        }
      >
        <div className="filters">
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label="Search transactions or accounts"
              placeholder="Transaction ID or account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            From
            <input
              aria-label="From date"
              type="datetime-local"
              value={filters.start}
              onChange={(e) => change("start", e.target.value)}
            />
          </label>
          <label>
            Until
            <input
              aria-label="Until date"
              type="datetime-local"
              value={filters.end}
              onChange={(e) => change("end", e.target.value)}
            />
          </label>
          <label>
            Min amount
            <input
              type="number"
              min="0"
              value={filters.min_amount}
              onChange={(e) => change("min_amount", e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Max amount
            <input
              type="number"
              min="0"
              value={filters.max_amount}
              onChange={(e) => change("max_amount", e.target.value)}
              placeholder="Unlimited"
            />
          </label>
          <label>
            Payment format
            <input
              value={filters.payment_format}
              onChange={(e) => change("payment_format", e.target.value)}
              placeholder="e.g. ACH"
            />
          </label>
          <label>
            Risk
            <select
              value={filters.risk_level}
              onChange={(e) => change("risk_level", e.target.value)}
            >
              <option value="">All levels</option>
              {["Low", "Medium", "High", "Critical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Detection
            <select
              value={filters.suspicious}
              onChange={(e) => change("suspicious", e.target.value)}
            >
              <option value="">All transactions</option>
              <option value="true">Flagged</option>
              <option value="false">Normal</option>
            </select>
          </label>
          <label>
            Sort by
            <select
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              {["timestamp", "amount", "risk_score", "id"].map((x) => (
                <option value={x} key={x}>
                  {x.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select
              value={filters.descending}
              onChange={(e) => change("descending", e.target.value)}
            >
              <option value="true">Descending</option>
              <option value="false">Ascending</option>
            </select>
          </label>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorView error={result.error} />
        ) : (
          <>
            <TransactionsTable
              rows={result.data!.items}
              onSelect={setSelected}
            />
            <Pagination
              page={page}
              total={result.data!.total}
              onChange={setPage}
            />
          </>
        )}
      </Panel>
      {selected && <TransactionDrawer id={selected} onClose={close} />}
    </>
  );
}
