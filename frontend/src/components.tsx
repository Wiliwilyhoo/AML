import { Component, useEffect, useRef, type ReactNode } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import cytoscape from "cytoscape";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Alert, GraphData, Tx } from "./types";
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
export const money = (value: number, currency = "USD") =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
export const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value.toLowerCase().replaceAll(" ", "-")}>
      <i />
      {value}
    </span>
  );
}
export function Empty({
  children = "No records match the current filters.",
}: {
  children?: ReactNode;
}) {
  return <div className="empty">{children}</div>;
}
export function Loading() {
  return (
    <div className="skeleton" role="status">
      <LoaderCircle className="spin" /> Loading monitoring data…
    </div>
  );
}
export function ErrorView({ error }: { error: unknown }) {
  return (
    <div className="notice danger" role="alert">
      {error instanceof Error ? error.message : "Unable to load data"}. Check
      that the backend is running.
    </div>
  );
}
export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </div>
      {children}
    </section>
  );
}
export function Chart({
  option,
  height = 260,
}: {
  option: EChartsOption;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!, undefined, { renderer: "canvas" });
    chart.setOption({
      backgroundColor: "transparent",
      color: ["#ff5300", "#141a24", "#e0a800", "#2b5ea8", "#8b95a5", "#a51c12"],
      textStyle: {
        color: "#566072",
        fontFamily: "Inter, Segoe UI, sans-serif",
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#dfe3e9",
        textStyle: { color: "#141a24" },
      },
      grid: { left: 54, right: 20, top: 25, bottom: 35 },
      ...option,
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current!);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option]);
  return (
    <div
      ref={ref}
      style={{ height, width: "100%" }}
      role="img"
      aria-label="Interactive analytics chart"
    />
  );
}
export function Pagination({
  page,
  total,
  size = 25,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {number(total)} results · Page {page} of{" "}
        {Math.max(1, Math.ceil(total / size))}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          disabled={page * size >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function TransactionsTable({
  rows,
  onSelect,
}: {
  rows: Tx[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction / time</th>
            <th>Source account</th>
            <th>Destination account</th>
            <th>Amount paid</th>
            <th>Payment</th>
            <th>Risk score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td>
                <button
                  className="text-link mono"
                  onClick={() => onSelect?.(tx.id)}
                  disabled={!onSelect}
                >
                  {tx.id}
                </button>
                <small>{date(tx.timestamp)}</small>
              </td>
              <td className="mono">
                <ArrowUpRight size={13} className="muted" /> {tx.sender}
              </td>
              <td className="mono">
                <ArrowDownLeft size={13} className="teal" /> {tx.receiver}
              </td>
              <td className="amount">{money(tx.amount, tx.currency)}</td>
              <td>{tx.payment_format}</td>
              <td>
                <span className="risk-bar">
                  <i style={{ width: tx.risk_score + "%" }} />
                </span>
                <span className="mono">{tx.risk_score}</span>{" "}
                <Badge value={tx.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function AlertsTable({ rows }: { rows: Alert[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Alert / detection time</th>
            <th>Detection rule</th>
            <th>Severity</th>
            <th>Score</th>
            <th>Review status</th>
            <th>Reviewer</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <Link className="mono text-link" to={"/investigations/" + a.id}>
                  {a.id}
                </Link>
                <small>{date(a.detected_at)}</small>
              </td>
              <td>
                <span className="rule-code">{a.rule_id}</span> {a.rule_name}
              </td>
              <td>
                <Badge value={a.severity} />
              </td>
              <td className="mono">{a.risk_score}</td>
              <td>
                <Badge value={a.status} />
              </td>
              <td>{a.reviewer || <span className="muted">Unassigned</span>}</td>
              <td>
                <Link className="text-link" to={"/investigations/" + a.id}>
                  Investigate <ChevronRight size={13} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex="0"]',
        );
        if (nodes?.length) {
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2>{title}</h2>
          <button aria-label="Close details" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Network({
  data,
  onSelect,
}: {
  data: GraphData;
  onSelect: (kind: string, id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const graph = cytoscape({
      container: ref.current,
      elements: [...data.nodes, ...data.edges],
      layout: { name: "cose", animate: false, nodeRepulsion: () => 80000 },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": 10,
            color: "#141a24",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "background-color": "#566072",
            width: 25,
            height: 25,
            "border-width": 5,
            "border-color": "#ffffff",
          },
        },
        {
          selector: "node[risk >= 50]",
          style: { "background-color": "#ff5300", "border-color": "#ffffff" },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#c3c9d3",
            "target-arrow-color": "#c3c9d3",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 8,
            color: "#566072",
            "text-rotation": "autorotate",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.8,
          },
        },
        {
          selector: "edge[risk > 0]",
          style: { "line-color": "#ff5300", "target-arrow-color": "#ff5300" },
        },
        {
          selector: ":selected",
          style: {
            "background-color": "#141a24",
            "line-color": "#141a24",
            "target-arrow-color": "#141a24",
          },
        },
      ],
    });
    graph.on("tap", "node", (e) => onSelect("account", e.target.id()));
    graph.on("tap", "edge", (e) => onSelect("transaction", e.target.id()));
    const resize = new ResizeObserver(() => graph.resize());
    resize.observe(ref.current!);
    return () => {
      resize.disconnect();
      graph.destroy();
    };
  }, [data, onSelect]);
  return (
    <>
      <div
        className="network"
        ref={ref}
        role="img"
        aria-label="Transaction network. Select accounts or transfers to inspect, or use the account and transfer list below."
      />
      <details className="network-list">
        <summary>Browse accounts and transfers with keyboard</summary>
        <div>
          {data.nodes.map((n) => (
            <button
              key={n.data.id}
              onClick={() => onSelect("account", n.data.id)}
            >
              Account {n.data.id} · risk {n.data.risk}
            </button>
          ))}
          {data.edges.map((e) => (
            <button
              key={e.data.id}
              onClick={() => onSelect("transaction", e.data.id)}
            >
              {e.data.source} → {e.data.target} · {e.data.label}
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        The view could not render.{" "}
        <button onClick={() => window.location.reload()}>
          Reload application
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
