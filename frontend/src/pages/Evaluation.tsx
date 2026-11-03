import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Dashboard } from "../types";
import { Chart, Empty, ErrorView, Loading, Panel, number } from "../components";
export default function Evaluation({ hours = 0 }: { hours?: number }) {
  const query = useQuery({
    queryKey: ["dashboard", hours],
    queryFn: () => api<Dashboard>("/dashboard?hours=" + hours),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorView error={query.error} />;
  const d = query.data!,
    e = d.evaluation;
  const percent = (n: number | null) =>
    n === null ? "N/A" : (n * 100).toFixed(1) + "%";
  return (
    <>
      <div className="notice">
        Transaction-level evaluation: predicted positive means at least one
        supporting-rule flag. Labels are used only here. {d.source}. Synthetic
        labels describe planted demo patterns.
      </div>
      {e.available ? (
        <>
          <div className="kpi-grid">
            {[
              ["Precision", percent(e.precision)],
              ["Recall", percent(e.recall)],
              ["F1 score", percent(e.f1)],
              ["False positive rate", percent(e.false_positive_rate)],
              ["False negative rate", percent(e.false_negative_rate)],
            ].map(([k, v]) => (
              <div className="kpi" key={k}>
                <div className="kpi-top">{k}</div>
                <strong>{v}</strong>
                <small>
                  {number(e.labeled_transactions)} labeled transactions
                </small>
              </div>
            ))}
          </div>
          <div className="grid-half">
            <Panel
              title="Confusion matrix"
              meta="Transaction-level · actual vs predicted"
            >
              <div className="confusion">
                <span />
                <span>Predicted flagged</span>
                <span>Predicted normal</span>
                <span>Actual positive</span>
                <strong className="tp">
                  {number(e.confusion.TP || 0)}
                  <small>True positives</small>
                </strong>
                <strong className="fn">
                  {number(e.confusion.FN || 0)}
                  <small>False negatives</small>
                </strong>
                <span>Actual negative</span>
                <strong className="fp">
                  {number(e.confusion.FP || 0)}
                  <small>False positives</small>
                </strong>
                <strong className="tn">
                  {number(e.confusion.TN || 0)}
                  <small>True negatives</small>
                </strong>
              </div>
            </Panel>
            <Panel title="Alert volume by rule" meta="Alert-level counts">
              <Chart
                option={{
                  xAxis: {
                    type: "category",
                    data: Object.keys(d.rules).map((x) =>
                      x.replaceAll(" ", "\n"),
                    ),
                    axisLabel: { fontSize: 9, interval: 0 },
                  },
                  yAxis: {
                    type: "value",
                    splitLine: { lineStyle: { color: "#1b293c" } },
                  },
                  series: [
                    {
                      type: "bar",
                      data: Object.values(d.rules),
                      barMaxWidth: 35,
                      itemStyle: {
                        color: "#2dd4bf",
                        borderRadius: [4, 4, 0, 0],
                      },
                    },
                  ],
                }}
              />
            </Panel>
          </div>
        </>
      ) : (
        <Panel title="Classification metrics">
          <Empty>
            Ground-truth labels are unavailable. Precision, recall and confusion
            metrics are hidden.
          </Empty>
        </Panel>
      )}
      <div className="grid-half">
        <Panel title="Operational performance" meta="Measured session data">
          <div className="context">
            <p>
              <span>Detection processing time</span>
              <strong>{d.detection_seconds.toFixed(3)} s</strong>
            </p>
            <p>
              <span>Mean processing latency / transaction</span>
              <strong>{d.mean_processing_ms.toFixed(3)} ms</strong>
            </p>
            <p>
              <span>Generated alerts</span>
              <strong>{number(d.alerts)}</strong>
            </p>
            <p>
              <span>Client-reported blockchain receipts</span>
              <strong>{d.blockchain.client_reported_receipts}</strong>
            </p>
            <p>
              <span>Reported gas usage</span>
              <strong>{number(d.blockchain.gas_used)}</strong>
            </p>
            <p>
              <span>Reported mean confirmation time</span>
              <strong>
                {d.blockchain.mean_confirmation_seconds === null
                  ? "No receipts"
                  : d.blockchain.mean_confirmation_seconds.toFixed(1) + " s"}
              </strong>
            </p>
            <p className="fine-print">
              Processing latency measures computation, not source-to-bank
              latency. Receipt statistics are client-reported; verify them via
              RPC on Blockchain Audit.
            </p>
          </div>
        </Panel>
        <Panel title="Case review distribution" meta="One case per alert">
          <Chart
            option={{
              tooltip: { trigger: "item" },
              legend: { bottom: 5, textStyle: { color: "#9aabc3" } },
              series: [
                {
                  type: "pie",
                  radius: ["45%", "70%"],
                  label: { show: false },
                  data: Object.entries(d.statuses).map(([name, value]) => ({
                    name,
                    value,
                  })),
                },
              ],
            }}
          />
        </Panel>
      </div>
      <p className="fine-print">
        Scores are rule-based priorities, not calibrated probabilities. This
        demo does not calculate alert-level precision or recall because source
        labels describe transactions, not alert contexts. A zero denominator is
        shown as N/A.
      </p>
    </>
  );
}
