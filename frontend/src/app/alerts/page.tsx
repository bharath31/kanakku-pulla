"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAlerts,
  getAlertSummary,
  markAlertRead,
  dismissAlert,
  type Alert,
  type AlertSummary,
} from "@/lib/api";
import { AlertTriangle, Info, AlertCircle, X, Eye } from "lucide-react";

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);

  useEffect(() => {
    loadAlerts();
    getAlertSummary().then(setSummary).catch(() => {});
  }, []);

  const loadAlerts = () => {
    getAlerts().then(setAlerts).catch(() => {});
  };

  const handleRead = async (id: number) => {
    await markAlertRead(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );
  };

  const handleDismiss = async (id: number) => {
    await dismissAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>

      {/* Summary */}
      {summary && (
        <div className="flex gap-4">
          <Badge variant="outline">{summary.total} total</Badge>
          <Badge variant="destructive">{summary.critical} critical</Badge>
          <Badge variant="secondary">{summary.warning} warning</Badge>
          <Badge>{summary.unread} unread</Badge>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const config =
              severityConfig[alert.severity as keyof typeof severityConfig] ||
              severityConfig.info;
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={`${!alert.is_read ? "border-l-4 border-l-primary" : ""}`}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{alert.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {alert.alert_type.replace("_", " ")}
                      </Badge>
                    </div>
                    {alert.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                        {alert.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!alert.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRead(alert.id)}
                        title="Mark as read"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDismiss(alert.id)}
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No alerts. Upload a statement to check for hidden charges.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
