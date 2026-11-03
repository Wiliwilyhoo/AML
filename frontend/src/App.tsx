import { useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FolderSearch,
  Gauge,
  GitBranch,
  Layers3,
  Menu,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Alerts from "./pages/Alerts";
import Investigation from "./pages/Investigation";
import Graph from "./pages/Graph";
import Rules from "./pages/Rules";
import Evaluation from "./pages/Evaluation";
import Audit from "./pages/Audit";
import { ErrorBoundary } from "./components";
import { api } from "./services/api";
import type { Replay } from "./types";
const navigation = [
  { path: "/", name: "Security Overview", icon: Gauge, section: "MONITOR" },
  { path: "/transactions", name: "Transaction Monitoring", icon: Activity },
  { path: "/alerts", name: "Alert Management", icon: ShieldAlert },
  {
    path: "/investigations",
    name: "Investigation Center",
    icon: FolderSearch,
    section: "INVESTIGATE",
  },
  { path: "/network", name: "Transaction Network", icon: GitBranch },
  { path: "/audit", name: "Blockchain Audit", icon: Layers3 },
  {
    path: "/rules",
    name: "Rule Configuration",
    icon: Settings2,
    section: "MANAGE",
  },
  { path: "/evaluation", name: "Evaluation & Analytics", icon: FileCheck2 },
];
export default function App() {
  const [scope, setScope] = useSearchParams();
  const hours = Number(scope.get("hours") || 0);
  const location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [socket, setSocket] = useState("Connecting");
  const [help, setHelp] = useState(false);
  const replay = useQuery({
    queryKey: ["replay"],
    queryFn: () => api<Replay>("/replay"),
    refetchInterval: 5000,
  });
  const command = useMutation({
    mutationFn: (action: string) =>
      api<Replay>("/replay", { action, speed: replay.data?.speed || 60 }),
    onSuccess: () => client.invalidateQueries(),
    onError: (e) => setToast(e.message),
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let active = true,
      ws: WebSocket,
      retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/live`,
      );
      ws.onopen = () => setSocket("Connected");
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        client.setQueryData(["replay"], msg);
        if (msg.type === "replay") {
          client.invalidateQueries({
            predicate: (q) => q.queryKey[0] !== "rules",
          });
          if (msg.new_alerts)
            setToast(`${msg.new_alerts} new rule alerts in simulated replay`);
        }
      };
      ws.onclose = () => {
        setSocket("Reconnecting");
        if (active) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retry);
      ws?.close();
    };
  }, [client]);
  const current =
    navigation.find((n) =>
      n.path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(n.path),
    ) || navigation[0];
  return (
    <ErrorBoundary>
      <div className={"app " + (collapsed ? "collapsed" : "")}>
        <aside className="sidebar">
          <NavLink to="/" className="brand">
            <span className="brand-mark">
              <Shield size={23} />
            </span>
            {!collapsed && (
              <div>
                AML<span>Sentinel</span>
                <small>SECURITY OPERATIONS</small>
              </div>
            )}
          </NavLink>
          <div className="workspace">
            <span className="workspace-avatar">S</span>
            {!collapsed && (
              <>
                <div>
                  Sentinel workspace<small>Compliance operations</small>
                </div>
                <ChevronDown size={13} />
              </>
            )}
          </div>
          <nav aria-label="Main navigation">
            {navigation.map((n) => (
              <div key={n.path}>
                {n.section && !collapsed && (
                  <p className="nav-section">{n.section}</p>
                )}
                <NavLink title={n.name} to={n.path} end={n.path === "/"}>
                  <n.icon size={18} />
                  {!collapsed && <span>{n.name}</span>}
                </NavLink>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {!collapsed && (
              <div className="engine-status">
                <span className="dot" />
                <div>
                  Detection engine<small>6 configurable rules</small>
                </div>
                <span className="teal">Active</span>
              </div>
            )}
            <button onClick={() => setHelp(!help)}>
              <CircleHelp size={17} />
              {!collapsed && "Demo guide & context"}
            </button>
            <div className="analyst">
              <div className="avatar">DA</div>
              {!collapsed && (
                <div>
                  Demo Analyst<small>Compliance reviewer · app identity</small>
                </div>
              )}
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumbs">
              Workspace <span>/</span> <strong>{current.name}</strong>
            </div>
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/transactions?q=" + encodeURIComponent(search));
              }}
            >
              <Search size={15} />
              <input
                aria-label="Global transaction search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions, accounts…"
              />
              <kbd>↵</kbd>
            </form>
            <span className="demo-pill">DEMO</span>
            <button
              className="icon-button"
              aria-label="Open alert queue"
              onClick={() => navigate("/alerts")}
            >
              <Bell size={18} />
            </button>
            <div className="avatar small-avatar">DA</div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  AML SENTINEL <span>/</span> SECURITY OPERATIONS
                </div>
                <h1>{current.name}</h1>
                <p>
                  {location.pathname === "/"
                    ? "A unified view of financial activity, emerging threats, and investigations."
                    : "Monitor signals, follow the evidence, and document every decision."}
                </p>
              </div>
              {["/", "/evaluation"].includes(location.pathname) && (
                <div className="time-range">
                  <Activity size={14} />
                  <label>
                    Time scope
                    <select
                      aria-label="Time scope"
                      value={hours}
                      onChange={(e) => setScope({ hours: e.target.value })}
                    >
                      <option value="0">All loaded time</option>
                      <option value="24">Last 24 source hours</option>
                      <option value="168">Last 7 source days</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            <div className="replay-bar">
              <div>
                <Radio
                  size={15}
                  className={replay.data?.running ? "teal" : "muted"}
                />
                <strong>Historical replay</strong>
                <span className="muted">
                  {replay.data?.mode === "snapshot"
                    ? "Full dataset snapshot"
                    : `${replay.data?.cursor || 0} / ${replay.data?.total || 0} processed`}
                </span>
                <span className="socket-status">
                  <i className={socket === "Connected" ? "dot" : "dot amber"} />
                  {socket}
                </span>
              </div>
              <div>
                <label className="speed-label">
                  Speed
                  <select
                    aria-label="Replay speed"
                    value={replay.data?.speed || 60}
                    onChange={(e) => {
                      api("/replay", {
                        action: "speed",
                        speed: Number(e.target.value),
                      })
                        .then(() =>
                          client.invalidateQueries({ queryKey: ["replay"] }),
                        )
                        .catch((e) => setToast(e.message));
                    }}
                  >
                    {[1, 30, 60, 300, 1000, 3600].map((n) => (
                      <option value={n} key={n}>
                        {n}×
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={command.isPending}
                  onClick={() => {
                    if (
                      replay.data?.mode === "snapshot" &&
                      !window.confirm(
                        "Start historical replay? This clears the loaded snapshot and investigations, preserving session evidence archives.",
                      )
                    )
                      return;
                    command.mutate(
                      replay.data?.running
                        ? "pause"
                        : replay.data?.mode === "snapshot"
                          ? "start"
                          : "resume",
                    );
                  }}
                >
                  {replay.data?.running ? (
                    <Pause size={13} />
                  ) : (
                    <Play size={13} />
                  )}{" "}
                  {replay.data?.running
                    ? "Pause"
                    : replay.data?.mode === "snapshot"
                      ? "Start"
                      : "Resume"}
                </button>
                <button
                  aria-label="Reset replay"
                  disabled={command.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset to an empty demo session? Transactions, alerts and investigation history clear. Evidence archives remain until server restart.",
                      )
                    )
                      command.mutate("reset");
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
            {help && (
              <div className="notice help">
                <button aria-label="Close guide" onClick={() => setHelp(false)}>
                  <X size={15} />
                </button>
                <strong>15-minute demo</strong>
                <p>
                  Review overview metrics → filter transactions → open an alert
                  → generate New evidence → commit via Blockchain Audit → start
                  investigation → add a note → generate a fresh decision version
                  → commit and verify → explore its network → adjust rules → run
                  historical replay → inspect evaluation.
                </p>
                <p>
                  Data and cases reset on backend restart. CSV labels never
                  drive detection. Connect a reviewer wallet and deploy using
                  contracts/README.md for real Sepolia operations.
                </p>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Overview hours={hours} />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route
                path="/investigations"
                element={<Alerts investigations />}
              />
              <Route
                path="/investigations/:id"
                element={<Investigation notify={setToast} />}
              />
              <Route path="/network" element={<Graph />} />
              <Route path="/rules" element={<Rules notify={setToast} />} />
              <Route
                path="/evaluation"
                element={<Evaluation hours={hours} />}
              />
              <Route path="/audit" element={<Audit notify={setToast} />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    View not found. <NavLink to="/">Return to overview</NavLink>
                  </div>
                }
              />
            </Routes>
            <footer>
              <span>
                <Shield size={12} /> AML Sentinel · University research
                demonstration
              </span>
              <span>
                In-memory session <i /> Simulated historical data <i /> Evidence
                before conclusions
              </span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
