"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMonthlyAnalytics,
  getAlertSummary,
  getAlerts,
  getTransactions,
  type MonthlyAnalytics,
  type AlertSummary,
  type Alert,
  type Transaction,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { IndianRupee, TrendingUp, AlertTriangle, Receipt, X } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { AIActivityFeed } from "@/components/ai-activity-feed";
import { CategoryPill } from "@/components/category-pill";
import { dismissAlert, markAlertRead } from "@/lib/api";

const CATEGORY_BAR_COLORS = [
  "#00DC82", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
];

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setError(null);
    Promise.all([
      getMonthlyAnalytics().then(setAnalytics),
      getAlertSummary().then(setAlertSummary),
      getAlerts({ limit: "5" }).then(setAlerts),
      getTransactions({ limit: "5" }).then(setRecentTxns),
    ]).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load data");
    });
  }, []);

  useEffect(() => {
    fetchData();

    // Re-fetch on tab focus (fixes stale data after navigation)
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
      // Update summary
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

  // Top 5 categories for horizontal stacked bar
  const topCategories = analytics?.category_breakdown.slice(0, 5) || [];
  const totalCategorySpend = topCategories.reduce((s, c) => s + c.amount, 0);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* AI Activity Feed — Hero */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          AI Activity
        </h3>
        <AIActivityFeed />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Spend"
          value={analytics ? `₹${analytics.total_spend.toLocaleString("en-IN")}` : "—"}
          icon={IndianRupee}
          subtitle={analytics ? `${monthNames[(analytics.month - 1) % 12]} ${analytics.year}` : undefined}
        />
        <StatCard
          label="Transactions"
          value={analytics?.transaction_count?.toString() ?? "—"}
          icon={Receipt}
        />
        <StatCard
          label="Fees"
          value={analytics ? `₹${analytics.total_fees.toLocaleString("en-IN")}` : "—"}
          icon={TrendingUp}
          color="text-accent-red"
        />
        <StatCard
          label="Alerts"
          value={alertSummary?.unread?.toString() ?? "—"}
          icon={AlertTriangle}
          color={alertSummary && alertSummary.critical > 0 ? "text-accent-red" : undefined}
        />
      </div>

      {/* Spending by Category — Horizontal stacked bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Spending by Category
        </h3>
        {topCategories.length > 0 ? (
          <div className="space-y-3">
            {/* Stacked bar */}
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
            {/* Legend */}
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
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No data yet. Upload a statement to get started.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Alerts
          </h3>
          {alerts.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No alerts
            </p>
          )}
        </div>

        {/* Daily Spending Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Daily Spending
          </h3>
          {analytics && analytics.daily_spend.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.daily_spend}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).getDate().toString()}
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
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spent"]}
                    labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN")}
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
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recent Transactions
        </h3>
        {recentTxns.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No transactions yet. Upload a statement to get started.
          </p>
        )}
      </div>
    </div>
  );
}
