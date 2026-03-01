"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCards,
  getStatements,
  uploadStatement,
  type Card as CardType,
  type Statement,
} from "@/lib/api";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function StatementsPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    getCards().then(setCards).catch(() => {});
    getStatements().then(setStatements).catch(() => {});
  }, []);

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
          `Statement parsed successfully! Found ${stmt.parse_status === "parsed" ? "transactions" : "0 transactions"}.`
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
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Statements</h1>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedCard} onValueChange={setSelectedCard}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select a card" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id.toString()}>
                  {card.bank} {card.card_name || ""}{" "}
                  {card.last_four ? `•••• ${card.last_four}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {cards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add a card in Settings first before uploading statements.
            </p>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Parsing your statement...</p>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-3">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Drop your CC statement PDF here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-500">{success}</p>
          )}
        </CardContent>
      </Card>

      {/* Statement History */}
      <Card>
        <CardHeader>
          <CardTitle>Statement History</CardTitle>
        </CardHeader>
        <CardContent>
          {statements.length > 0 ? (
            <div className="space-y-3">
              {statements.map((stmt) => (
                <div
                  key={stmt.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        Statement{" "}
                        {stmt.statement_date
                          ? new Date(stmt.statement_date).toLocaleDateString(
                              "en-IN",
                              { month: "long", year: "numeric" }
                            )
                          : `#${stmt.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stmt.source === "email" ? "Via email" : "Uploaded"} ·{" "}
                        {new Date(stmt.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {stmt.total_due && (
                      <span className="text-sm font-mono">
                        ₹{Number(stmt.total_due).toLocaleString("en-IN")}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {statusIcon(stmt.parse_status)}
                      <Badge variant="outline" className="text-xs">
                        {stmt.parse_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No statements uploaded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
