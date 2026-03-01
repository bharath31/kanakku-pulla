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
  createCardInbox,
  type Card as CardType,
} from "@/lib/api";
import { Plus, Trash2, CreditCard, Copy, Check, Mail, ArrowRight } from "lucide-react";

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
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [creatingInbox, setCreatingInbox] = useState<number | null>(null);

  useEffect(() => {
    getCards().then(setCards).catch(() => {});
  }, []);

  const selectedBank = BANKS.find((b) => b.id === bank);

  const handleAddCard = async () => {
    if (!bank || !holderName) return;
    try {
      const newCard = await createCard({
        bank,
        card_name: cardName || undefined,
        last_four: lastFour || undefined,
        holder_name: holderName,
        dob: dob || undefined,
      });
      setCards((prev) => [...prev, newCard]);
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

  const handleCopyEmail = (card: CardType) => {
    if (!card.inbox_email) return;
    navigator.clipboard.writeText(card.inbox_email);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetupInbox = async (cardId: number) => {
    setCreatingInbox(cardId);
    try {
      const updated = await createCardInbox(cardId);
      setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
    } catch {
      // ignore
    } finally {
      setCreatingInbox(null);
    }
  };

  const cardsWithInbox = cards.filter((c) => c.inbox_email);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Email Forwarding Section */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Forwarding Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Forward your bank&apos;s credit card statement email to the address below.
            Kanakku Pulla will automatically parse and analyse the PDF attachment.
          </p>

          {cardsWithInbox.length > 0 ? (
            <div className="space-y-3">
              {cardsWithInbox.map((card) => (
                <div key={card.id} className="rounded-lg border bg-background p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {BANKS.find((b) => b.id === card.bank)?.name || card.bank}
                    {card.card_name && ` — ${card.card_name}`}
                    {card.last_four && ` (••${card.last_four})`}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-muted px-3 py-1.5 rounded select-all">
                      {card.inbox_email}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyEmail(card)}
                      className="shrink-0"
                    >
                      {copiedId === card.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Add a credit card below to get your forwarding email address.
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm">How to forward emails:</p>
            <div className="space-y-1.5">
              <p><span className="font-medium text-foreground">HDFC / ICICI:</span> The bank sends the statement as a PDF attachment. Simply forward the email to your inbox address above.</p>
              <p><span className="font-medium text-foreground">SBI / Axis:</span> Same — forward the statement email with the PDF attachment.</p>
              <p><span className="font-medium text-foreground">Gmail tip:</span> Create a filter for emails from your bank, then auto-forward to the address above.</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  Used to unlock password-protected statement PDFs.
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
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
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

                {/* Email inbox row */}
                {card.inbox_email ? (
                  <div className="flex items-center gap-2 pl-11">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
                      {card.inbox_email}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleCopyEmail(card)}
                    >
                      {copiedId === card.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="pl-11">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={creatingInbox === card.id}
                      onClick={() => handleSetupInbox(card.id)}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      {creatingInbox === card.id ? "Setting up..." : "Setup email inbox"}
                    </Button>
                  </div>
                )}
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
          <div className="flex gap-3 items-start">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0 mt-0.5">
              1
            </Badge>
            <p>Add your credit card details above (bank + name + DOB for PDF password unlock)</p>
          </div>
          <div className="flex gap-3 items-start">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0 mt-0.5">
              2
            </Badge>
            <div>
              <p className="font-medium">Forward statement emails to your inbox address</p>
              <p className="text-muted-foreground mt-1">
                Each card gets a unique address like{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">name-bank@agentmail.to</code>.
                When your bank sends a statement email, forward it there — the PDF is parsed automatically.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Or:</span> Upload the PDF manually on the Statements page
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0 mt-0.5">
              3
            </Badge>
            <p>
              Transactions are automatically parsed, categorized, and checked for hidden fees
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0 mt-0.5">
              4
            </Badge>
            <p>Check Dashboard for spending insights, Alerts page for hidden charges</p>
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
          <p>
            Email forwarding uses AgentMail to receive emails; only the PDF attachment is processed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
