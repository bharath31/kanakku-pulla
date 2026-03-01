"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getMonthlyAnalytics,
  getAlertSummary,
  getAlerts,
  getTransactions,
  getAIActivity,
  getCards,
  type MonthlyAnalytics,
  type AlertSummary,
  type Alert,
  type Transaction,
  type AIActivity,
  type Card,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  Receipt,
  X,
  Upload,
  Sparkles,
  Tag,
  Copy,
  ArrowRight,
  Bot,
  Mail,
  Check,
} from "lucide-react";
import { dismissAlert, markAlertRead } from "@/lib/api";
import { CategoryPill } from "@/components/category-pill";

const CATEGORY_BAR_COLORS = [
  "#00DC82", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
];

const ACTION_ICONS: Record<string, typeof Sparkles> = {
  categorized: Tag,
  fee_detected: AlertTriangle,
  duplicate_found: Copy,
  alert_created: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  categorized: "text-accent-green",
  fee_detected: "text-accent-red",
  duplicate_found: "text-accent-amber",
  alert_created: "text-accent-amber",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);

  const fetchData = useCallback(() => {
    setError(null);
    Promise.all([
      getMonthlyAnalytics().then(setAnalytics),
      getAlertSummary().then(setAlertSummary),
      getAlerts({ limit: "5" }).then(setAlerts),
      getTransactions({ limit: "5" }).then(setRecentTxns),
      getAIActivity(10).then(setActivities),
      getCards().then(setCards),
    ])
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    fetchData();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

  const handleDismissAlert = async (alertId: number) => {
    try {
      await dismissAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      getAlertSummary().then(setAlertSummary).catch(() => {});
    } catch { /* ignore */ }
  };

  const handleMarkRead = async (alertId: number) => {
    try {
      await markAlertRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
    } catch { /* ignore */ }
  };

  // Determine what we have data for
  const hasTransactions = analytics && analytics.transaction_count > 0;
  const hasAlerts = alerts.length > 0;
  const hasActivity = activities.length > 0;
  const hasMonthlySpend = analytics && analytics.monthly_spend.some((m) => m.amount > 0);
  const hasAnyData = hasTransactions || hasAlerts || hasActivity || (recentTxns.length > 0);
  const topCategories = analytics?.category_breakdown.slice(0, 5) || [];
  const totalCategorySpend = topCategories.reduce((s, c) => s + c.amount, 0);

  if (!loaded) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-4" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state — no data at all
  if (!hasAnyData && !error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 md:p-12 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Welcome to Kanakku Pulla</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload your first credit card statement and the AI will automatically
              parse transactions, categorize spending, and detect hidden fees.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/statements"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Statement
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Add a Card First
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="pt-4 border-t border-border/50 text-xs text-muted-foreground space-y-1.5 max-w-sm mx-auto text-left">
            <p className="font-medium text-foreground text-sm mb-2">How it works:</p>
            <p>1. Add your credit card in Settings (bank + name for PDF unlock)</p>
            <p>2. Upload the PDF statement or set up email forwarding</p>
            <p>3. AI parses, categorizes, and flags hidden fees automatically</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* AI Activity Feed — only show if there are activities */}
      {hasActivity && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="ai-pulse absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
            </span>
            <h3 className="text-xs font-semibold text-accent-green uppercase tracking-wider">
              AI Activity
            </h3>
          </div>
          <div className="space-y-1">
            {activities.map((activity) => {
              const Icon = ACTION_ICONS[activity.action_type] || Sparkles;
              const color = ACTION_COLORS[activity.action_type] || "text-primary";
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg bg-muted ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats row — only show cards that have meaningful data */}
      {hasTransactions && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Spend</span>
              <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight">
              ₹{analytics!.total_spend.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {monthNames[(analytics!.month - 1) % 12]} {analytics!.year}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Transactions</span>
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight">
              {analytics!.transaction_count}
            </p>
          </div>

          {analytics!.total_fees > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fees</span>
                <TrendingUp className="h-3.5 w-3.5 text-accent-red" />
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight text-accent-red">
                ₹{analytics!.total_fees.toLocaleString("en-IN")}
              </p>
            </div>
          )}

          {alertSummary && alertSummary.unread > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Alerts</span>
                <AlertTriangle className={`h-3.5 w-3.5 ${alertSummary.critical > 0 ? "text-accent-red" : "text-accent-amber"}`} />
              </div>
              <p className={`text-2xl font-bold font-mono tracking-tight ${alertSummary.critical > 0 ? "text-accent-red" : "text-accent-amber"}`}>
                {alertSummary.unread}
              </p>
              {alertSummary.critical > 0 && (
                <p className="text-[10px] text-accent-red mt-0.5">
                  {alertSummary.critical} critical
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Email Forwarding — show if user has cards with inboxes */}
      {cards.some((c) => c.inbox_email) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
              Auto-import via Email
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Forward your bank&apos;s statement email to automatically parse it:
          </p>
          <div className="space-y-2">
            {cards.filter((c) => c.inbox_email).map((card) => (
              <div key={card.id} className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  {card.bank}{card.last_four ? ` ••${card.last_four}` : ""}:
                </span>
                <code className="text-xs font-mono text-foreground flex-1 truncate select-all">
                  {card.inbox_email}
                </code>
                <button
                  className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(card.inbox_email!);
                    setCopiedEmail(card.id);
                    setTimeout(() => setCopiedEmail(null), 2000);
                  }}
                >
                  {copiedEmail === card.id ? (
                    <Check className="h-3.5 w-3.5 text-accent-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No email inboxes — nudge to set up */}
      {cards.length > 0 && !cards.some((c) => c.inbox_email) && (
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
        >
          <Mail className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Set up email forwarding</p>
            <p className="text-xs text-muted-foreground">Auto-import statements by forwarding bank emails</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Spending by Category — only if we have categories */}
      {topCategories.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Spending by Category
          </h3>
          <div className="space-y-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {topCategories.map((cat, i) => (
                <div
                  key={cat.name}
                  className="h-full transition-all"
                  style={{
                    width: `${(cat.amount / totalCategorySpend) * 100}%`,
                    backgroundColor: CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length],
                  }}
                  title={`${cat.name}: ₹${cat.amount.toLocaleString("en-IN")}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {topCategories.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{cat.name}</span>
                  <span className="font-mono font-medium">
                    ₹{cat.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alerts + Chart row — only show sections with data */}
      {(hasAlerts || hasMonthlySpend) && (
        <div className={`grid grid-cols-1 ${hasAlerts && hasMonthlySpend ? "lg:grid-cols-2" : ""} gap-4`}>
          {/* Recent Alerts */}
          {hasAlerts && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Recent Alerts
              </h3>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => !alert.is_read && handleMarkRead(alert.id)}
                    className={`relative rounded-lg p-3 border transition-colors cursor-pointer ${
                      alert.severity === "critical"
                        ? "border-l-2 border-l-accent-red border-border"
                        : alert.severity === "warning"
                        ? "border-l-2 border-l-accent-amber border-border"
                        : "border-border"
                    } ${!alert.is_read ? "bg-muted/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {alert.description?.split("\n")[0]}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissAlert(alert.id);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Spending Trend */}
          {hasMonthlySpend && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Monthly Spending
              </h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics!.monthly_spend}>
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m) => {
                        const [, mm] = m.split("-");
                        return monthNames[parseInt(mm) - 1] || m;
                      }}
                      fontSize={11}
                      tick={{ fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tick={{ fill: "#888888" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                    />
                    <Tooltip
                      formatter={(v: unknown) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spent"]}
                      labelFormatter={(m) => {
                        const [yy, mm] = m.split("-");
                        return `${monthNames[parseInt(mm) - 1]} ${yy}`;
                      }}
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid #222222",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#00DC82"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions — only if we have some */}
      {recentTxns.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Transactions
            </h3>
            <Link
              href="/transactions"
              className="text-xs text-primary hover:underline font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-1">
            {recentTxns.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                    {(txn.merchant_name || txn.description || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.merchant_name || txn.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {txn.txn_date}
                      </span>
                      {txn.category_name && (
                        <CategoryPill name={txn.category_name} />
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`font-mono font-semibold text-sm whitespace-nowrap ${
                    txn.amount < 0 ? "text-accent-green" : ""
                  }`}
                >
                  {txn.amount < 0 ? "+" : ""}₹
                  {Math.abs(txn.amount).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick action — always show upload CTA at bottom */}
      {hasTransactions && (
        <div className="flex items-center justify-center py-2">
          <Link
            href="/statements"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload another statement
          </Link>
        </div>
      )}
    </div>
  );
}
