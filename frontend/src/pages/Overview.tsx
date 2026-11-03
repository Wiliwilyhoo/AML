import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ShieldAlert,
  ScanLine,
  Wallet,
  FolderSearch,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Dashboard } from "../types";
import {
  AlertsTable,
  Chart,
  Empty,
  ErrorView,
  Loading,
  Panel,
  date,
  money,
  number,
} from "../components";
export default function Overview({ hours = 0 }: { hours?: number }) {
  const query = useQuery({
    queryKey: ["dashboard", hours],
    queryFn: () => api<Dashboard>("/dashboard?hours=" + hours),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorView error={query.error} />;
  const d = query.data!;
  const currencies = Object.keys(d.volume_by_currency);
  const currency = currencies[0] || "USD";
  const times = [...new Set(d.volume_trend.map((x) => x.time))];
  const kpis = [
    {
      label: "Total transactions",
      value: number(d.transactions),
      icon: ScanLine,
      meta: "Loaded in active session",
    },
    {
      label: "Transaction volume",
      value:
        new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 2,
        }).format(d.volume_by_currency[currency] || 0) +
        " " +
        currency,
      icon: Wallet,
      meta:
        currencies.length > 1
          ? "Primary currency · totals below"
          : "Source currency · no FX conversion",
    },
    {
      label: "Flagged transactions",
      value: number(d.flagged),
      icon: ShieldAlert,
      meta: (d.flagged_rate * 100).toFixed(1) + "% of monitored transactions",
    },
    {
      label: "Open investigations",
      value: number(d.open_investigations),
      icon: FolderSearch,
      meta: "Under review or escalated",
    },
    {
      label: "High-risk accounts",
      value: number(d.high_risk_accounts),
      icon: Users,
      meta: "Linked to a transaction scoring 50+",
    },
  ];
  return (
    <>
      <div className="section-line">
        <span>
          <i className="dot" /> Detection engine operational
        </span>
        <span>
          {d.source} <span className="divider">/</span>{" "}
          {hours ? "Last " + hours + " source hours" : "All loaded time"}
        </span>
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-top">
              {k.label}
              <k.icon size={17} />
            </div>
            <strong>{k.value}</strong>
            <small>{k.meta}</small>
          </div>
        ))}
      </div>
      <div className="grid-wide">
        <Panel
          title="Transaction volume over time"
          meta={
            <span className="legend">
              <i /> {currency} · hourly
            </span>
          }
        >
          <Chart
            option={{
              xAxis: {
                type: "category",
                data: times.map((x) => x.slice(5)),
                axisLine: { lineStyle: { color: "#253249" } },
                axisLabel: { color: "#7b8ca5" },
              },
              yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: "#1b293c" } },
                axisLabel: {
                  formatter: (v: number) =>
                    v >= 1000000 ? (v / 1e6).toFixed(1) + "m" : v / 1000 + "k",
                },
              },
              series: [
                {
                  name: currency,
                  type: "line",
                  smooth: 0.3,
                  symbol: "none",
                  data: times.map(
                    (t) =>
                      d.volume_trend.find(
                        (x) => x.time === t && x.currency === currency,
                      )?.amount || 0,
                  ),
                  lineStyle: { width: 2, color: "#2dd4bf" },
                  areaStyle: {
                    color: {
                      type: "linear",
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: "#2dd4bf40" },
                        { offset: 1, color: "#2dd4bf00" },
                      ],
                    },
                  },
                },
              ],
            }}
          />
        </Panel>
        <Panel title="Risk severity distribution" meta="Flagged transactions">
          <Chart
            option={{
              tooltip: { trigger: "item" },
              legend: {
                bottom: 0,
                textStyle: { color: "#9aabc3" },
                itemWidth: 9,
                itemHeight: 9,
              },
              series: [
                {
                  type: "pie",
                  radius: ["52%", "75%"],
                  center: ["50%", "43%"],
                  label: { show: false },
                  itemStyle: { borderColor: "#111b29", borderWidth: 4 },
                  data: ["Critical", "High", "Medium", "Low"].map(
                    (name, i) => ({
                      name,
                      value: d.severity[name] || 0,
                      itemStyle: {
                        color: ["#fb7185", "#fbbf24", "#60a5fa", "#2dd4bf"][i],
                      },
                    }),
                  ),
                },
              ],
              graphic: [
                {
                  type: "text",
                  left: "center",
                  top: "34%",
                  style: {
                    text: number(d.flagged),
                    fill: "#e2e8f0",
                    fontSize: 30,
                    fontWeight: 600,
                  },
                },
                {
                  type: "text",
                  left: "center",
                  top: "48%",
                  style: { text: "FLAGGED", fill: "#8292aa", fontSize: 10 },
                },
              ],
            }}
          />
        </Panel>
      </div>
      <div className="grid-half">
        <Panel
          title="Suspicious activity trend"
          meta={
            <span className="teal">
              <Activity size={13} /> Rule-based signals
            </span>
          }
        >
          <Chart
            height={220}
            option={{
              xAxis: {
                type: "category",
                data: d.suspicious_trend.map((x) => x.time.slice(5)),
              },
              yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: "#1b293c" } },
              },
              series: [
                {
                  type: "bar",
                  barMaxWidth: 24,
                  data: d.suspicious_trend.map((x) => x.count),
                  itemStyle: { color: "#5a8de0", borderRadius: [3, 3, 0, 0] },
                },
              ],
            }}
          />
        </Panel>
        <Panel
          title="Top triggered AML rules"
          meta={number(d.alerts) + " alerts"}
        >
          <div className="rule-ranks">
            {Object.entries(d.rules)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count], i) => (
                <div className="rank" key={name}>
                  <span className="muted mono">0{i + 1}</span>
                  <div>
                    <div>
                      {name}
                      <strong>{number(count)}</strong>
                    </div>
                    <div className="track">
                      <i
                        style={{
                          width:
                            (count / Math.max(...Object.values(d.rules))) *
                              100 +
                            "%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            {!d.alerts && <Empty />}
          </div>
        </Panel>
      </div>
      <Panel
        title="Highest priority alerts"
        meta={
          <Link className="text-link" to="/alerts">
            View all alerts <ArrowRight size={14} />
          </Link>
        }
      >
        <AlertsTable rows={d.recent_alerts} />
      </Panel>
      <div className="grid-half">
        <Panel title="Recent investigation activity" meta="Session history">
          {d.activity.length ? (
            d.activity.map((h, i) => (
              <div className="activity" key={i}>
                <span className="activity-dot" />
                <div>
                  <Link to={"/investigations/" + h.alert_id}>
                    {h.reviewer} → {h.to}
                  </Link>
                  <small>
                    {h.alert_id} · {date(h.at)}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <Empty>Start an investigation to build your review history.</Empty>
          )}
        </Panel>
        <Panel title="Monitoring context" meta="Transparent by design">
          <div className="context">
            <p>
              <span className="muted">Source</span>
              <span>{d.source}</span>
            </p>
            <p>
              <span className="muted">Flagged rate</span>
              <span>{(d.flagged_rate * 100).toFixed(2)}%</span>
            </p>
            {Object.entries(d.volume_by_currency).map(([c, v]) => (
              <p key={c}>
                <span className="muted">Volume · {c}</span>
                <span>{money(v, c)}</span>
              </p>
            ))}
            <p className="fine-print">
              Flags and scores are explainable review signals. Synthetic labels
              are demo scenarios, not confirmed criminal activity.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
