import { useEffect, useRef, useState } from "react";
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
const navGroups = [
  {
    name: "Monitor",
    items: [
      {
        path: "/",
        name: "Security Overview",
        blurb: "Activity, flags and open reviews",
        icon: Gauge,
      },
      {
        path: "/transactions",
        name: "Transaction Monitoring",
        blurb: "Search and filter every transfer",
        icon: Activity,
      },
      {
        path: "/alerts",
        name: "Alert Management",
        blurb: "Work through flagged activity",
        icon: ShieldAlert,
      },
    ],
  },
  {
    name: "Investigate",
    items: [
      {
        path: "/investigations",
        name: "Investigation Center",
        blurb: "Review cases and record decisions",
        icon: FolderSearch,
      },
      {
        path: "/network",
        name: "Transaction Network",
        blurb: "Follow funds between accounts",
        icon: GitBranch,
      },
      {
        path: "/audit",
        name: "Blockchain Audit",
        blurb: "Commit and verify evidence on Sepolia",
        icon: Layers3,
      },
    ],
  },
  {
    name: "Manage",
    items: [
      {
        path: "/rules",
        name: "Rule Configuration",
        blurb: "Adjust thresholds and rerun detection",
        icon: Settings2,
      },
      {
        path: "/evaluation",
        name: "Evaluation & Analytics",
        blurb: "Measure precision, recall and cost",
        icon: FileCheck2,
      },
    ],
  },
];
const navigation = navGroups.flatMap((group) => group.items);
const isActive = (path: string, pathname: string) =>
  path === "/" ? pathname === "/" : pathname.startsWith(path);
export default function App() {
  const [scope, setScope] = useSearchParams();
  const hours = Number(scope.get("hours") || 0);
  const location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState("");
  const navRef = useRef<HTMLElement>(null);
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
  useEffect(() => {
    setOpenGroup("");
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!openGroup) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpenGroup("");
      } else if (!navRef.current?.contains(event.target as Node)) {
        setOpenGroup("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [openGroup]);
  const current =
    navigation.find((n) => isActive(n.path, location.pathname)) ||
    navigation[0];
  const timeScope = ["/", "/evaluation"].includes(location.pathname);
  return (
    <ErrorBoundary>
      <div className="main-shell">
        <header className="site-header">
          <div className="site-header-inner">
            <NavLink to="/" className="brand">
              <Shield size={24} fill="currentColor" />
              AML Sentinel
            </NavLink>
            <nav
              ref={navRef}
              className={"site-nav " + (menuOpen ? "open" : "")}
              aria-label="Main navigation"
            >
              {navGroups.map((group) => (
                <div className="nav-group" key={group.name}>
                  <button
                    className={
                      group.items.some((n) =>
                        isActive(n.path, location.pathname),
                      )
                        ? "active"
                        : ""
                    }
                    aria-expanded={openGroup === group.name}
                    onClick={() =>
                      setOpenGroup(openGroup === group.name ? "" : group.name)
                    }
                  >
                    {group.name} <ChevronDown size={14} />
                  </button>
                  <div className="nav-menu" hidden={openGroup !== group.name && !menuOpen}>
                    {group.items.map((n) => (
                      <NavLink key={n.path} to={n.path} end={n.path === "/"}>
                        <n.icon size={19} />
                        <strong>{n.name}</strong>
                        <small>{n.blurb}</small>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="header-tools">
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
              </form>
              <span className="demo-pill">Demo</span>
              <button
                className="icon-button"
                aria-label="Open demo guide"
                onClick={() => setHelp(!help)}
              >
                <CircleHelp size={19} />
              </button>
              <NavLink to="/alerts" className="button primary">
                Review alerts
              </NavLink>
              <button
                className="icon-button menu-toggle"
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </header>
        <div className="replay-bar">
          <div className="replay-inner">
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
              {timeScope && (
                <label className="strip-label">
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
              )}
              <label className="strip-label">
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
        </div>
        <main>
          {location.pathname !== "/" && (
            <div className="page-heading">
              <h1>{current.name}</h1>
              <p>{current.blurb}</p>
            </div>
          )}
          {help && (
            <div className="notice help">
              <button aria-label="Close guide" onClick={() => setHelp(false)}>
                <X size={15} />
              </button>
              <strong>15-minute demo</strong>
              <p>
                Review overview metrics → filter transactions → open an alert →
                generate New evidence → commit via Blockchain Audit → start
                investigation → add a note → generate a fresh decision version →
                commit and verify → explore its network → adjust rules → run
                historical replay → inspect evaluation.
              </p>
              <p>
                Data and cases reset on backend restart. CSV labels never drive
                detection. Connect a reviewer wallet and deploy using
                contracts/README.md for real Sepolia operations.
              </p>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Overview hours={hours} />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/investigations" element={<Alerts investigations />} />
            <Route
              path="/investigations/:id"
              element={<Investigation notify={setToast} />}
            />
            <Route path="/network" element={<Graph />} />
            <Route path="/rules" element={<Rules notify={setToast} />} />
            <Route path="/evaluation" element={<Evaluation hours={hours} />} />
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
        </main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>
              <strong>AML Sentinel</strong> university demonstration with
              simulated data
            </span>
            <span>Detection engine active, 6 configurable rules</span>
          </div>
        </footer>
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
