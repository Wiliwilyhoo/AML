import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, params } from "../services/api";
import type { Alert, Page } from "../types";
import {
  AlertsTable,
  ErrorView,
  Loading,
  Pagination,
  Panel,
} from "../components";
export default function Alerts({
  investigations = false,
}: {
  investigations?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: investigations ? "Under Review" : "",
    severity: "",
    rule_id: "",
    sort: "detected_at",
    descending: "true",
  });
  const change = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const query = params({ ...filters, page });
  const result = useQuery({
    queryKey: ["alerts", query],
    queryFn: () => api<Page<Alert>>("/alerts?" + query),
  });
  return (
    <Panel
      title={investigations ? "Investigation queue" : "Detection queue"}
      meta="Explainable signals · analyst review required"
    >
      <div className="filters">
        <label className="grow">
          Search
          <input
            value={filters.q}
            onChange={(e) => change("q", e.target.value)}
            placeholder="Alert, transaction, reviewer or rule…"
          />
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {["New", "Under Review", "Escalated", "Dismissed", "Closed"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Severity
          <select
            value={filters.severity}
            onChange={(e) => change("severity", e.target.value)}
          >
            <option value="">All severities</option>
            {["Low", "Medium", "High", "Critical"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Rule
          <select
            value={filters.rule_id}
            onChange={(e) => change("rule_id", e.target.value)}
          >
            <option value="">All rules</option>
            {["HV", "VEL", "STR", "FIN", "FOUT", "RAP"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            {["detected_at", "risk_score", "status", "id"].map((x) => (
              <option key={x}>{x}</option>
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
          <AlertsTable rows={result.data!.items} />
          <Pagination
            page={page}
            total={result.data!.total}
            onChange={setPage}
          />
        </>
      )}
    </Panel>
  );
}
