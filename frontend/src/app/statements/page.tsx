"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  getCards,
  getStatements,
  uploadStatement,
  type Card as CardType,
  type Statement,
} from "@/lib/api";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function StatementsPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    getCards().then((c) => {
      setCards(c);
      if (c.length > 0 && !selectedCard) setSelectedCard(c[0].id.toString());
    }).catch(() => {});
    getStatements().then(setStatements).catch(() => {});
  }, [selectedCard]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!selectedCard) {
        setError("Please select a card first");
        return;
      }
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file");
        return;
      }

      setUploading(true);
      setError("");
      setSuccess("");

      try {
        const stmt = await uploadStatement(file, parseInt(selectedCard));
        setSuccess(
          `Statement parsed successfully! Status: ${stmt.parse_status}`
        );
        getStatements().then(setStatements).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [selectedCard]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "parsed":
        return <CheckCircle className="h-3.5 w-3.5 text-accent-green" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-accent-red" />;
      default:
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Card selector as pills */}
      {cards.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card.id.toString())}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCard === card.id.toString()
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {card.bank} {card.last_four ? `••${card.last_four}` : ""}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a card in Settings first.
        </p>
      )}

      {/* Upload area — Minimal */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Parsing statement...</p>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Drop PDF</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-accent-green">{success}</p>}

      {/* Statement list */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
        {statements.length > 0 ? (
          statements.map((stmt) => (
            <div
              key={stmt.id}
              className="flex items-center justify-between px-5 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {stmt.statement_date
                    ? new Date(stmt.statement_date).toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      })
                    : `Statement #${stmt.id}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(stmt.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {stmt.total_due != null && (
                  <span className="text-sm font-mono">
                    ₹{Number(stmt.total_due).toLocaleString("en-IN")}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  {statusIcon(stmt.parse_status)}
                  <Badge variant="outline" className="text-[10px]">
                    {stmt.parse_status}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm py-12 text-center">
            No statements uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}
