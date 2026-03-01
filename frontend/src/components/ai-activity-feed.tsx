"use client";

import { useEffect, useState, useCallback } from "react";
import { getAIActivity, type AIActivity } from "@/lib/api";
import { Sparkles, Tag, AlertTriangle, Copy, Bot } from "lucide-react";

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

export function AIActivityFeed() {
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(() => {
    getAIActivity(10)
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchActivities();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchActivities();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <Bot className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No AI activity yet. Upload a statement to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* AI Active indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="ai-pulse absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
        </span>
        <span className="text-xs font-medium text-accent-green">AI Active</span>
      </div>

      {activities.map((activity) => {
        const Icon = ACTION_ICONS[activity.action_type] || Sparkles;
        const color = ACTION_COLORS[activity.action_type] || "text-primary";

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0"
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
  );
}
