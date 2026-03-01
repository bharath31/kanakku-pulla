"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getTransactions,
  getCategories,
  updateCategory,
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

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterFees, setFilterFees] = useState<string>("");

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    loadTransactions();
  }, []);

  const loadTransactions = (params?: Record<string, string>) => {
    getTransactions({ limit: "200", ...params }).then(setTxns).catch(() => {});
  };

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterFees === "fees") params.is_fee = "true";
    if (filterFees === "no_fees") params.is_fee = "false";
    loadTransactions(params);
  };

  const handleCategoryChange = async (txnId: number, categoryId: string) => {
    try {
      const updated = await updateCategory(txnId, parseInt(categoryId));
      setTxns((prev) =>
        prev.map((t) => (t.id === txnId ? { ...t, ...updated } : t))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search merchant or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-xs"
        />
        <Select value={filterFees} onValueChange={(v) => { setFilterFees(v); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="fees">Fees only</SelectItem>
            <SelectItem value="no_fees">No fees</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          Search
        </button>
      </div>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle>{txns.length} Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length > 0 ? (
            <div className="space-y-2">
              {txns.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between border-b py-3 last:border-0 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {txn.merchant_name || txn.description}
                      </p>
                      {txn.is_fee && (
                        <Badge variant="destructive" className="text-xs">
                          {txn.fee_type?.replace("_", " ") || "Fee"}
                        </Badge>
                      )}
                      {txn.is_emi && (
                        <Badge variant="secondary" className="text-xs">
                          EMI
                        </Badge>
                      )}
                      {txn.is_international && (
                        <Badge variant="outline" className="text-xs">
                          Intl
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {txn.txn_date}
                      {txn.description !== txn.merchant_name &&
                        ` · ${txn.description}`}
                    </p>
                  </div>

                  {/* Category Selector */}
                  <Select
                    value={txn.category_id?.toString() || ""}
                    onValueChange={(v) => handleCategoryChange(txn.id, v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span
                    className={`font-mono font-medium whitespace-nowrap ${
                      txn.amount < 0 ? "text-green-500" : ""
                    }`}
                  >
                    {txn.amount < 0 ? "+" : ""}₹
                    {Math.abs(txn.amount).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No transactions found. Upload a statement to see your transactions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
