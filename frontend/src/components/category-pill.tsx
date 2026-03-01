"use client";

const CATEGORY_COLORS: Record<string, string> = {
  "Groceries": "#22C55E",
  "Dining": "#F97316",
  "Fuel": "#EAB308",
  "Shopping": "#3B82F6",
  "Travel": "#8B5CF6",
  "Entertainment": "#EC4899",
  "Utilities": "#06B6D4",
  "Healthcare": "#EF4444",
  "Subscriptions": "#A855F7",
  "Education": "#14B8A6",
  "Insurance": "#6366F1",
  "EMI": "#78716C",
  "Fees & Charges": "#EF4444",
  "Transfers": "#64748B",
  "Other": "#888888",
};

interface CategoryPillProps {
  name: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function CategoryPill({ name, onClick, interactive = false }: CategoryPillProps) {
  const color = CATEGORY_COLORS[name] || "#888888";
  const Component = interactive ? "button" : "span";

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
        interactive
          ? "cursor-pointer hover:bg-muted border border-border"
          : "bg-muted"
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </Component>
  );
}
