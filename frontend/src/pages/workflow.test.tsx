// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "./Overview";
import Transactions from "./Transactions";
import Investigation from "./Investigation";
import Audit from "./Audit";
import Graph from "./Graph";
import { api } from "../services/api";
import { configured } from "../services/web3";
vi.mock("../services/api", async () => ({
  ...(await vi.importActual("../services/api")),
  api: vi.fn(),
}));
vi.mock("../components", async () => ({
  ...(await vi.importActual("../components")),
  Chart: () => <div>Chart</div>,
  Network: ({ data }: { data: { nodes: unknown[]; edges: unknown[] } }) => (
    <div>
      {data.nodes.length} nodes · {data.edges.length} edges
    </div>
  ),
}));
const mocked = vi.mocked(api);
const tx = {
  id: "TX-demo",
  timestamp: "2025-01-06T00:00:00Z",
  sender: "001:A",
  receiver: "001:B",
  amount: 12000,
  currency: "USD",
  payment_format: "ACH",
  risk_score: 30,
  risk_level: "Medium",
  suspicious: true,
  rule_ids: ["HV"],
};
const alert = {
  id: "AL-demo",
  transaction_id: tx.id,
  transaction_ids: [tx.id],
  rule_id: "HV",
  rule_name: "High-value transfer",
  severity: "Medium",
  risk_score: 30,
  status: "New",
  detected_at: tx.timestamp,
  reviewer: "",
  explanation: "Amount exceeded threshold.",
  notes: [],
  history: [],
  transactions: [tx],
  allowed_statuses: ["Under Review", "Dismissed"],
  evidence: [],
};
function mount(element: React.ReactNode, path = "/") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
          <Route path="/investigations/:id" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Connected dashboard workflows", () => {
  it("renders computed dashboard values", async () => {
    mocked.mockResolvedValue({
      source: "Synthetic",
      transactions: 1234,
      volume_by_currency: { USD: 90000 },
      flagged: 25,
      flagged_rate: 25 / 1234,
      open_investigations: 3,
      high_risk_accounts: 4,
      alerts: 25,
      volume_trend: [],
      suspicious_trend: [],
      severity: { Medium: 25 },
      rules: { "High-value transfer": 25 },
      recent_alerts: [],
      activity: [],
    });
    mount(<Overview />);
    expect(await screen.findByText("1,234")).toBeTruthy();
    expect(screen.getByText("90K USD")).toBeTruthy();
  });
  it("sends server-side transaction filters and opens details", async () => {
    mocked.mockImplementation(async (path) =>
      path.startsWith("/transactions?")
        ? { items: [tx], total: 1, page: 1, page_size: 25 }
        : { ...tx, alerts: [alert], related: [] },
    );
    mount(<Transactions />);
    await screen.findByText("TX-demo");
    fireEvent.change(screen.getByLabelText("Min amount"), {
      target: { value: "10000" },
    });
    await waitFor(() =>
      expect(
        mocked.mock.calls.some(([p]) => p.includes("min_amount=10000")),
      ).toBe(true),
    );
    fireEvent.click(await screen.findByText("TX-demo"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
  it("opens an alert, updates its case and generates evidence", async () => {
    mocked.mockImplementation(async (path) =>
      path.startsWith("/graph")
        ? { nodes: [], edges: [], limited: false }
        : alert,
    );
    mount(<Investigation notify={() => {}} />, "/investigations/AL-demo");
    await screen.findByText("High-value transfer");
    fireEvent.click(screen.getByText("Start investigation"));
    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith("/alerts/AL-demo/review", {
        status: "Under Review",
        reviewer: "Demo Analyst",
        note: "",
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Document findings and rationale…"),
      { target: { value: "Reviewed network" } },
    );
    fireEvent.click(screen.getByText("Add note"));
    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith("/alerts/AL-demo/notes", {
        reviewer: "Demo Analyst",
        text: "Reviewed network",
      }),
    );
    fireEvent.click(screen.getByText("Generate evidence hash"));
    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith("/alerts/AL-demo/evidence", {
        reviewer: "Demo Analyst",
      }),
    );
  });
  it("maps bounded graph elements", async () => {
    mocked.mockResolvedValue({
      nodes: [{ data: { id: "001:A" } }, { data: { id: "001:B" } }],
      edges: [{ data: { id: "TX-demo", source: "001:A", target: "001:B" } }],
      limited: false,
    });
    mount(<Graph />);
    expect(await screen.findByText("2 nodes · 1 edges")).toBeTruthy();
  });
  it("displays blockchain configuration and missing MetaMask states", async () => {
    mocked.mockResolvedValue([]);
    mount(<Audit notify={() => {}} />);
    expect(await screen.findByText(configured ? /Sepolia configured/ : /Blockchain unconfigured/)).toBeTruthy();
    fireEvent.click(screen.getByText("Connect MetaMask"));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("MetaMask is not installed"),
    );
  });
});
