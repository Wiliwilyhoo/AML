import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Rules as Config, RuleInfo } from "../types";
import { ErrorView, Loading, Panel } from "../components";
const fields: Record<
  Exclude<keyof Config, "enabled">,
  [string, number, number, number]
> = {
  high_value: ["High-value threshold", 1, 1e12, 1],
  velocity_count: ["Velocity count", 2, 1000, 1],
  window_minutes: ["Rolling window (minutes)", 1, 10080, 1],
  structuring_threshold: ["Structuring threshold", 1, 1e12, 1],
  structuring_floor: ["Structuring lower fraction", 0.01, 0.99, 0.01],
  structuring_count: ["Structuring count", 2, 1000, 1],
  fan_in_count: ["Distinct fan-in senders", 2, 1000, 1],
  fan_out_count: ["Distinct fan-out receivers", 2, 1000, 1],
  rapid_minutes: ["Rapid movement window (minutes)", 1, 1440, 1],
};
export default function Rules({ notify }: { notify: (s: string) => void }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["rules"],
    queryFn: () => api<{ config: Config; rules: RuleInfo[] }>("/rules"),
  });
  const [config, setConfig] = useState<Config>();
  useEffect(() => {
    if (query.data) setConfig(query.data.config);
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => api("/rules", config, "PUT"),
    onSuccess: () => {
      client.invalidateQueries();
      notify("Detection rerun complete. Alerts and metrics updated.");
    },
    onError: (e) => notify(e.message),
  });
  if (query.isPending || !config)
    return query.error ? <ErrorView error={query.error} /> : <Loading />;
  return (
    <>
      <div className="notice">
        These are configurable demonstration parameters, not universal
        regulatory thresholds. Amount thresholds apply independently in each
        source currency. Pause replay before rerunning.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            window.confirm(
              "Rerun detection? Surviving investigations are retained. Removed alert contexts leave the queue; evidence archives remain.",
            )
          )
            save.mutate();
        }}
      >
        <div className="grid-half">
          <Panel title="Detection parameters" meta="Validated on the server">
            <div className="rule-inputs">
              {Object.entries(fields).map(([key, [label, min, max, step]]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={config[key as Exclude<keyof Config, "enabled">]}
                    onChange={(e) =>
                      setConfig({ ...config, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </Panel>
          <Panel title="Rule catalogue" meta="Interpretable additive weights">
            <div className="rule-catalogue">
              {query.data!.rules.map((rule) => (
                <label className="rule-item" key={rule.id}>
                  <input
                    type="checkbox"
                    checked={config.enabled.includes(rule.id)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        enabled: e.target.checked
                          ? [...config.enabled, rule.id]
                          : config.enabled.filter((x) => x !== rule.id),
                      })
                    }
                  />
                  <div>
                    <strong>
                      <span className="rule-code">{rule.id}</span> {rule.name}
                    </strong>
                    <p>{rule.description}</p>
                    <small>
                      Risk contribution +{rule.weight} · aggregate capped at 100
                    </small>
                  </div>
                </label>
              ))}
            </div>
          </Panel>
        </div>
        <div className="action-row">
          <button className="primary" disabled={save.isPending} type="submit">
            {save.isPending
              ? "Rerunning detection…"
              : "Save configuration & rerun detection"}
          </button>
          <p className="fine-print">
            Detection uses source timestamps and historical context only.
          </p>
        </div>
      </form>
    </>
  );
}
