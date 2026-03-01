"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  createCard,
  deleteCard,
  type Card as CardType,
} from "@/lib/api";
import { Plus, Trash2, CreditCard, Copy, Check } from "lucide-react";

const BANKS = [
  { id: "hdfc", name: "HDFC Bank", passwordHint: "First 4 letters of name (lowercase) + DDMM of DOB" },
  { id: "icici", name: "ICICI Bank", passwordHint: "First 4 letters of name (lowercase) + DDMM of DOB" },
  { id: "sbi", name: "SBI", passwordHint: "First 4 letters of name (UPPERCASE) + DDMM of DOB" },
  { id: "axis", name: "Axis Bank", passwordHint: "First 4 letters of name (UPPERCASE) + DDMM of DOB" },
  { id: "kotak", name: "Kotak Mahindra Bank", passwordHint: "CRN number" },
];

export default function SettingsPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [bank, setBank] = useState("");
  const [cardName, setCardName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [holderName, setHolderName] = useState("");
  const [dob, setDob] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getCards().then(setCards).catch(() => {});
  }, []);

  const selectedBank = BANKS.find((b) => b.id === bank);

  const handleAddCard = async () => {
    if (!bank || !holderName) return;

    try {
      await createCard({
        bank,
        card_name: cardName || undefined,
        last_four: lastFour || undefined,
        holder_name: holderName,
        dob: dob || undefined,
      });
      getCards().then(setCards);
      setShowAddCard(false);
      setBank("");
      setCardName("");
      setLastFour("");
      setHolderName("");
      setDob("");
    } catch {
      // ignore
    }
  };

  const handleDeleteCard = async (id: number) => {
    await deleteCard(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Cards</CardTitle>
          <Button size="sm" onClick={() => setShowAddCard(!showAddCard)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Card
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddCard && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="space-y-2">
                <Label>Bank</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBank && (
                  <p className="text-xs text-muted-foreground">
                    PDF Password: {selectedBank.passwordHint}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Card Name (optional)</Label>
                  <Input
                    placeholder="e.g. Regalia Gold"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last 4 Digits (optional)</Label>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={lastFour}
                    onChange={(e) => setLastFour(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Card Holder Name (as on card)</Label>
                <Input
                  placeholder="BHARATH KUMAR"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to generate PDF password. Enter exactly as on card.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date of Birth (optional)</Label>
                <Input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to generate PDF password for most banks.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddCard} disabled={!bank || !holderName}>
                  Save Card
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddCard(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {cards.length > 0 ? (
            cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {BANKS.find((b) => b.id === card.bank)?.name || card.bank}
                      {card.card_name && ` — ${card.card_name}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card.holder_name}
                      {card.last_four && ` · •••• ${card.last_four}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteCard(card.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No cards added yet. Add your credit card to start analyzing statements.
            </p>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">
              1
            </Badge>
            <p>Add your credit card details above (bank + name for PDF password)</p>
          </div>
          <div className="flex gap-3">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">
              2
            </Badge>
            <p>Upload your credit card statement PDF on the Statements page</p>
          </div>
          <div className="flex gap-3">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">
              3
            </Badge>
            <p>
              We automatically parse transactions, detect hidden fees, and categorize your spending
            </p>
          </div>
          <div className="flex gap-3">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0">
              4
            </Badge>
            <p>Check Dashboard for insights, Alerts for hidden charges</p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Security</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Kanakku Pulla is self-hosted — your data never leaves your machine.
          </p>
          <p>
            All statement data is stored locally in SQLite. No external databases, no cloud storage.
          </p>
          <p>
            AI categorization (optional) sends only merchant names to Cloudflare Workers AI — no personal data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
