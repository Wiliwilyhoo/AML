export type Status =
  | "New"
  | "Under Review"
  | "Escalated"
  | "Dismissed"
  | "Closed";
export type Tx = {
  id: string;
  timestamp: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  amount_received: number;
  receiving_currency: string;
  payment_format: string;
  risk_score: number;
  risk_level: string;
  suspicious: boolean;
  rule_ids: string[];
  alerts?: Alert[];
  related?: Tx[];
};
export type History = {
  at: string;
  from: string;
  to: string;
  reviewer: string;
  note: string;
  alert_id?: string;
};
export type Alert = {
  id: string;
  transaction_id: string;
  transaction_ids: string[];
  rule_id: string;
  rule_name: string;
  severity: string;
  risk_score: number;
  detected_at: string;
  status: Status;
  reviewer: string;
  explanation: string;
  notes: { at: string; reviewer: string; text: string }[];
  history: History[];
  transactions?: Tx[];
  allowed_statuses?: Status[];
  evidence?: Evidence[];
};
export type EvidencePayload = [
  string,
  string,
  string[],
  string[],
  string,
  Status,
  string,
  number,
  string,
];
export type Evidence = {
  alert_id: string;
  version: number;
  payload: EvidencePayload;
  canonical: string;
  hash: string;
  created_at: string;
  receipt: null | {
    transaction_hash: string;
    gas_used: string;
    block_number: number;
    confirmation_seconds: number;
    action: string;
    trust: string;
  };
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type Rules = {
  high_value: number;
  velocity_count: number;
  window_minutes: number;
  structuring_threshold: number;
  structuring_floor: number;
  structuring_count: number;
  fan_in_count: number;
  fan_out_count: number;
  rapid_minutes: number;
  enabled: string[];
};
export type RuleInfo = {
  id: string;
  name: string;
  description: string;
  weight: number;
};
export type GraphData = {
  nodes: { data: { id: string; label: string; risk: number } }[];
  edges: {
    data: {
      id: string;
      source: string;
      target: string;
      label: string;
      risk: number;
    };
  }[];
  limited: boolean;
};
export type Replay = {
  running: boolean;
  mode: string;
  cursor: number;
  total: number;
  speed: number;
  revision: number;
};
export type Dashboard = {
  source: string;
  transactions: number;
  volume_by_currency: Record<string, number>;
  flagged: number;
  flagged_rate: number;
  open_investigations: number;
  high_risk_accounts: number;
  alerts: number;
  volume_trend: { time: string; currency: string; amount: number }[];
  suspicious_trend: { time: string; count: number }[];
  severity: Record<string, number>;
  rules: Record<string, number>;
  statuses: Record<string, number>;
  recent_alerts: Alert[];
  activity: History[];
  evaluation: {
    available: boolean;
    labeled_transactions: number;
    confusion: Record<string, number>;
    precision: number | null;
    recall: number | null;
    f1: number | null;
    false_positive_rate: number | null;
    false_negative_rate: number | null;
  };
  detection_seconds: number;
  mean_processing_ms: number;
  blockchain: {
    client_reported_receipts: number;
    gas_used: number;
    mean_confirmation_seconds: number | null;
  };
};
