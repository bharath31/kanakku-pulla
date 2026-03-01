"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getTransactions,
  getCategories,
  updateCategory,
  autoCategorize,
  type Transaction,
  type Category,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterChips } from "@/components/filter-chips";
import { CategoryPill } from "@/components/category-pill";
import { Sparkles, Loader2 } from "lucide-react";

const FILTER_CHIPS = [
  { label: "All", value: "all" },
  { label: "Fees", value: "fees" },
  { label: "Uncategorized", value: "uncategorized" },
  { label: "International", value: "international" },
];

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeResult, setCategorizeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(
    (params?: Record<string, string>) => {
      setError(null);
      getTransactions({ limit: "200", ...params })
        .then(setTxns)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    },
    []
  );

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    loadTransactions();
  }, [loadTransactions]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeFilter === "fees") params.is_fee = "true";
      loadTransactions(params);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeFilter, loadTransactions]);

  const handleFilterChange = (value: string) => {
    setActiveFilter(value);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (value === "fees") params.is_fee = "true";
    loadTransactions(params);
  };

  const handleCategoryChange = async (txnId: number, categoryId: string) => {
    try {
      const updated = await updateCategory(txnId, parseInt(categoryId));
      setTxns((prev) =>
        prev.map((t) => (t.id === txnId ? { ...t, ...updated } : t))
      );
    } catch { /* ignore */ }
  };

  const handleAutoCategorize = async () => {
    setCategorizing(true);
    setCategorizeResult(null);
    try {
      const result = await autoCategorize();
      setCategorizeResult(
        result.categorized > 0
          ? `Categorized ${result.categorized} transaction${result.categorized !== 1 ? "s" : ""}${
              result.remaining > 0 ? `, ${result.remaining} remaining` : ""
            }`
          : "No uncategorized transactions found"
      );
      loadTransactions();
    } catch (err) {
      setCategorizeResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setCategorizing(false);
    }
  };

  // Filter uncategorized/international client-side
  const filteredTxns =
    activeFilter === "uncategorized"
      ? txns.filter((t) => !t.category_id && !t.is_fee)
      : activeFilter === "international"
      ? txns.filter((t) => t.is_international)
      : txns;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Search bar */}
      <Input
        placeholder="Search transactions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-lg bg-card border-border"
      />

      {/* Filter chips + Auto-categorize */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterChips
          chips={FILTER_CHIPS}
          active={activeFilter}
          onChange={handleFilterChange}
        />
        <button
          onClick={handleAutoCategorize}
          disabled={categorizing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {categorizing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {categorizing ? "Categorizing..." : "Auto-categorize"}
        </button>
      </div>

      {categorizeResult && (
        <p className="text-xs text-accent-green">{categorizeResult}</p>
      )}

      {/* Transaction List */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-3 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">
            {filteredTxns.length} transaction{filteredTxns.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {filteredTxns.length > 0 ? (
            filteredTxns.map((txn) => (
              <div
                key={txn.id}
                className={`flex items-center justify-between px-5 py-3 gap-4 ${
                  !txn.category_id && !txn.is_fee
                    ? "border-l-2 border-l-accent-amber/50"
                    : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {txn.merchant_name || txn.description}
                    </p>
                    {txn.is_fee && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {txn.fee_type?.replace("_", " ") || "Fee"}
                      </Badge>
                    )}
                    {txn.is_emi && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        EMI
                      </Badge>
                    )}
                    {txn.is_international && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Intl
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {txn.txn_date}
                  </p>
                </div>

                {/* Category */}
                <div className="shrink-0">
                  <Select
                    value={txn.category_id?.toString() || ""}
                    onValueChange={(v) => handleCategoryChange(txn.id, v)}
                  >
                    <SelectTrigger className={txn.category_name
                      ? "border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0 cursor-pointer"
                      : "w-[120px] h-7 text-xs"
                    }>
                      {txn.category_name ? (
                        <CategoryPill name={txn.category_name} />
                      ) : (
                        <SelectValue placeholder="Assign..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
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
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-12 text-center">
              No transactions found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
