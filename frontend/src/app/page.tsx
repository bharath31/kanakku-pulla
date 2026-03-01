"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getMonthlyAnalytics,
  getAlertSummary,
  getTransactions,
  type MonthlyAnalytics,
  type AlertSummary,
  type Transaction,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { IndianRupee, TrendingUp, AlertTriangle, Receipt } from "lucide-react";

const COLORS = [
  "#22c55e", "#f97316", "#eab308", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#ef4444", "#a855f7", "#14b8a6",
];

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [alerts, setAlerts] = useState<AlertSummary | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);

  useEffect(() => {
    getMonthlyAnalytics().then(setAnalytics).catch(() => {});
    getAlertSummary().then(setAlerts).catch(() => {});
    getTransactions({ limit: "5" }).then(setRecentTxns).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Alert Banner */}
      {alerts && alerts.unread > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>
            You have <strong>{alerts.unread}</strong> unread alert
            {alerts.unread > 1 ? "s" : ""}
            {alerts.critical > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.critical} critical
              </Badge>
            )}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spend
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? `₹${analytics.total_spend.toLocaleString("en-IN")}` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.transaction_count ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fees & Charges
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {analytics ? `₹${analytics.total_fees.toLocaleString("en-IN")}` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts?.unread ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {analytics && analytics.category_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.category_breakdown}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {analytics.category_breakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => `₹${Number(v).toLocaleString("en-IN")}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data yet. Upload a statement to get started.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Spending</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {analytics && analytics.daily_spend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.daily_spend}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).getDate().toString()}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(v: unknown) => `₹${Number(v).toLocaleString("en-IN")}`}
                    labelFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-IN")
                    }
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length > 0 ? (
            <div className="space-y-3">
              {recentTxns.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {txn.merchant_name || txn.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.txn_date} · {txn.category_name || "Uncategorized"}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-medium ${txn.amount < 0 ? "text-green-500" : ""}`}
                  >
                    {txn.amount < 0 ? "+" : ""}₹
                    {Math.abs(txn.amount).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No transactions yet. Upload a credit card statement to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
