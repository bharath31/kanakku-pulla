"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMonthlyAnalytics,
  getSpendingTrends,
  getFeeBreakdown,
  type MonthlyAnalytics,
  type TrendData,
  type FeeBreakdown,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "#22c55e", "#f97316", "#eab308", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#ef4444", "#a855f7", "#14b8a6",
];

export default function AnalyticsPage() {
  const [monthly, setMonthly] = useState<MonthlyAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [fees, setFees] = useState<FeeBreakdown | null>(null);

  useEffect(() => {
    getMonthlyAnalytics().then(setMonthly).catch(() => {});
    getSpendingTrends(6).then(setTrends).catch(() => {});
    getFeeBreakdown().then(setFees).catch(() => {});
  }, []);

  // Transform trends for line chart
  const allCategories = [...new Set(trends.flatMap((t) => Object.keys(t.categories)))];
  const trendChartData = trends.map((t) => ({
    month: t.month,
    ...t.categories,
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          {/* Category breakdown bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {monthly && monthly.category_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly.category_breakdown}
                    layout="vertical"
                  >
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                    <Tooltip
                      formatter={(v: unknown) => `₹${Number(v).toLocaleString("en-IN")}`}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>6-Month Spending Trends</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(v: unknown) => `₹${Number(v).toLocaleString("en-IN")}`}
                    />
                    {allCategories.slice(0, 8).map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Need at least 2 months of data.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly && monthly.top_merchants.length > 0 ? (
                <div className="space-y-3">
                  {monthly.top_merchants.map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm w-6">
                          #{i + 1}
                        </span>
                        <span className="font-medium">{m.name}</span>
                      </div>
                      <span className="font-mono">
                        ₹{m.amount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  No merchant data yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fee Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {fees && fees.breakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fees.breakdown.map((b) => ({
                          name: b.type.replace("_", " "),
                          value: b.amount,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name }) => name}
                      >
                        {fees.breakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) =>
                          `₹${Number(v).toLocaleString("en-IN")}`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No fees detected.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Total Fees: ₹{fees?.total_fees.toLocaleString("en-IN") || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fees && fees.breakdown.length > 0 ? (
                  <div className="space-y-3">
                    {fees.breakdown.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize">
                          {b.type.replace("_", " ")}
                        </span>
                        <span className="font-mono text-destructive">
                          ₹{b.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No fees found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
