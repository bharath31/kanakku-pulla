import { getToken } from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api/v1`
    : "http://localhost:8000/api/v1");

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  return res.json();
}

// Auth
export const signup = (username: string, password: string, email?: string) =>
  request<{ access_token: string }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, email }),
  });

export const login = (username: string, password: string) =>
  request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = () =>
  request<{ id: number; username: string; email: string | null; totp_enabled: boolean }>("/auth/me");

// 2FA
export const setup2FA = () =>
  request<{ secret: string; otpauth_uri: string }>("/auth/2fa/setup", { method: "POST" });

export const confirm2FA = (code: string) =>
  request<{ ok: boolean }>("/auth/2fa/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const disable2FA = (code: string) =>
  request<{ ok: boolean }>("/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const verify2FA = (code: string) =>
  request<{ access_token: string }>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

// Cards
export const getCards = () => request<Card[]>("/cards/");
export const createCard = (data: CardCreate) =>
  request<Card>("/cards/", { method: "POST", body: JSON.stringify(data) });
export const deleteCard = (id: number) =>
  request("/cards/" + id, { method: "DELETE" });
export const createCardInbox = (cardId: number) =>
  request<Card>(`/cards/${cardId}/inbox`, { method: "POST" });

// Statements
export const getStatements = (cardId?: number) =>
  request<Statement[]>("/statements/" + (cardId ? `?card_id=${cardId}` : ""));

export const uploadStatement = async (file: File, cardId: number) => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/statements/upload?card_id=${cardId}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Upload failed");
  }
  return res.json() as Promise<Statement>;
};

// Transactions
export const getTransactions = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<Transaction[]>("/transactions/" + qs);
};

export const updateCategory = (txnId: number, categoryId: number) =>
  request<Transaction>(`/transactions/${txnId}/category`, {
    method: "PUT",
    body: JSON.stringify({ category_id: categoryId }),
  });

export const getCategories = () => request<Category[]>("/transactions/categories");

export const autoCategorize = () =>
  request<{ categorized: number; remaining: number }>("/transactions/auto-categorize", {
    method: "POST",
  });

// Analytics
export const getMonthlyAnalytics = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<MonthlyAnalytics>("/analytics/monthly" + qs);
};

export const getSpendingTrends = (months?: number) =>
  request<TrendData[]>("/analytics/trends" + (months ? `?months=${months}` : ""));

export const getFeeBreakdown = () => request<FeeBreakdown>("/analytics/fees");

// Alerts
export const getAlerts = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<Alert[]>("/alerts/" + qs);
};

export const getAlertSummary = () => request<AlertSummary>("/alerts/summary");

export const markAlertRead = (id: number) =>
  request(`/alerts/${id}/read`, { method: "PUT" });

export const dismissAlert = (id: number) =>
  request(`/alerts/${id}/dismiss`, { method: "PUT" });

// AI Activity
export const getAIActivity = (limit?: number) =>
  request<AIActivity[]>(`/ai/activity${limit ? `?limit=${limit}` : ""}`);

// Types
export interface Card {
  id: number;
  bank: string;
  card_name: string | null;
  last_four: string | null;
  holder_name: string;
  dob: string | null;
  credit_limit: number | null;
  inbox_id: number | null;
  inbox_email: string | null;
}

export interface CardCreate {
  bank: string;
  card_name?: string;
  last_four?: string;
  holder_name: string;
  dob?: string;
  credit_limit?: number;
}

export interface Statement {
  id: number;
  card_id: number;
  statement_date: string | null;
  due_date: string | null;
  total_due: number | null;
  min_due: number | null;
  parse_status: string;
  source: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  statement_id: number;
  card_id: number;
  txn_date: string | null;
  description: string | null;
  merchant_name: string | null;
  amount: number;
  currency: string;
  category_id: number | null;
  category_name: string | null;
  is_fee: boolean;
  fee_type: string | null;
  is_emi: boolean;
  is_international: boolean;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface MonthlyAnalytics {
  month: number;
  year: number;
  total_spend: number;
  total_fees: number;
  transaction_count: number;
  category_breakdown: { name: string; amount: number }[];
  monthly_spend: { month: string; amount: number }[];
  top_merchants: { name: string; amount: number }[];
}

export interface TrendData {
  month: string;
  categories: Record<string, number>;
}

export interface FeeBreakdown {
  total_fees: number;
  breakdown: { type: string; amount: number }[];
}

export interface Alert {
  id: number;
  transaction_id: number | null;
  statement_id: number | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface AlertSummary {
  total: number;
  unread: number;
  critical: number;
  warning: number;
}

export interface AIActivity {
  id: number;
  action_type: string;
  description: string;
  metadata_json: string | null;
  created_at: string;
}
