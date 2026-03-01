"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCards,
  createCard,
  deleteCard,
  createCardInbox,
  getMe,
  setup2FA,
  confirm2FA,
  disable2FA,
  type Card as CardType,
} from "@/lib/api";
import {
  Plus,
  Trash2,
  CreditCard,
  Copy,
  Check,
  Mail,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const BANKS = [
  { id: "hdfc", name: "HDFC Bank", passwordHint: "First 4 letters of name (lowercase) + DDMM of DOB" },
  { id: "icici", name: "ICICI Bank", passwordHint: "First 4 letters of name (lowercase) + DDMM of DOB" },
  { id: "sbi", name: "SBI", passwordHint: "First 4 letters of name (UPPERCASE) + DDMM of DOB" },
  { id: "axis", name: "Axis Bank", passwordHint: "First 4 letters of name (UPPERCASE) + DDMM of DOB" },
  { id: "kotak", name: "Kotak Mahindra Bank", passwordHint: "CRN number" },
  { id: "amex", name: "American Express", passwordHint: "First 4 letters of name (UPPERCASE) + DDMMYYYY of DOB" },
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
  const [emailExpanded, setEmailExpanded] = useState(false);

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupSecret, setTotpSetupSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpMessage, setTotpMessage] = useState<string | null>(null);
  const [totpError, setTotpError] = useState<string | null>(null);

  useEffect(() => {
    getCards().then(setCards).catch(() => {});
    getMe().then((me) => setTotpEnabled(me.totp_enabled)).catch(() => {});
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ } finally {
      setCreatingInbox(null);
    }
  };

  const handleSetup2FA = async () => {
    setTotpError(null);
    setTotpMessage(null);
    try {
      const result = await setup2FA();
      setTotpSetupSecret(result.secret);
      setTotpUri(result.otpauth_uri);
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Setup failed");
    }
  };

  const handleConfirm2FA = async () => {
    setTotpError(null);
    try {
      await confirm2FA(totpCode);
      setTotpEnabled(true);
      setTotpSetupSecret(null);
      setTotpUri(null);
      setTotpCode("");
      setTotpMessage("2FA enabled successfully");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Invalid code");
    }
  };

  const handleDisable2FA = async () => {
    setTotpError(null);
    try {
      await disable2FA(totpDisableCode);
      setTotpEnabled(false);
      setTotpDisableCode("");
      setTotpMessage("2FA disabled");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Invalid code");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Cards Section */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Your Cards</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddCard(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Card
          </Button>
        </div>
        <div className="divide-y divide-border/50">
          {cards.length > 0 ? (
            cards.map((card) => (
              <div key={card.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {BANKS.find((b) => b.id === card.bank)?.name || card.bank}
                        {card.card_name && ` — ${card.card_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {card.holder_name}
                        {card.last_four && ` · ••${card.last_four}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteCard(card.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>

                {card.inbox_email ? (
                  <div className="flex items-center gap-2 pl-9">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <code className="text-[11px] font-mono text-muted-foreground flex-1 truncate">
                      {card.inbox_email}
                    </code>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyEmail(card)}
                    >
                      {copiedId === card.id ? (
                        <Check className="h-3 w-3 text-accent-green" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="pl-9">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
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
            <p className="text-muted-foreground text-sm py-8 text-center">
              No cards added yet.
            </p>
          )}
        </div>
      </div>

      {/* Email forwarding — collapsed by default */}
      <div className="rounded-xl border border-border bg-card">
        <button
          className="flex items-center justify-between w-full px-5 py-4 text-left"
          onClick={() => setEmailExpanded(!emailExpanded)}
        >
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Email Forwarding Setup</h3>
          </div>
          {emailExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {emailExpanded && (
          <div className="px-5 pb-4 space-y-3 text-sm text-muted-foreground border-t border-border pt-3">
            <p>Forward your bank&apos;s statement email to the inbox address shown under each card above.</p>
            <p><strong className="text-foreground">Gmail tip:</strong> Create a filter to auto-forward bank emails.</p>
            <p><strong className="text-foreground">HDFC / ICICI / SBI / Axis:</strong> Forward the email with the PDF attachment.</p>
          </div>
        )}
      </div>

      {/* 2FA Security */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {totpEnabled ? (
              <ShieldCheck className="h-4 w-4 text-accent-green" />
            ) : (
              <Shield className="h-4 w-4 text-muted-foreground" />
            )}
            <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {totpMessage && (
            <p className="text-sm text-accent-green">{totpMessage}</p>
          )}
          {totpError && (
            <p className="text-sm text-destructive">{totpError}</p>
          )}

          {totpEnabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                2FA is enabled. Enter a code to disable it.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 2FA code"
                  value={totpDisableCode}
                  onChange={(e) => setTotpDisableCode(e.target.value)}
                  className="max-w-[180px]"
                  maxLength={6}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDisable2FA}
                  disabled={totpDisableCode.length < 6}
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : totpSetupSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan this code in your authenticator app, or enter the secret manually:
              </p>
              <code className="block text-xs font-mono bg-muted px-3 py-2 rounded-lg break-all select-all">
                {totpSetupSecret}
              </code>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code from app"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="max-w-[180px]"
                  maxLength={6}
                />
                <Button
                  size="sm"
                  onClick={handleConfirm2FA}
                  disabled={totpCode.length < 6}
                >
                  Verify & Enable
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security with an authenticator app.
              </p>
              <Button size="sm" variant="outline" onClick={handleSetup2FA}>
                <Shield className="h-3.5 w-3.5 mr-1" />
                Setup 2FA
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credit Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Card Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. Regalia Gold"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Last 4 Digits <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  placeholder="1234"
                  maxLength={4}
                  value={lastFour}
                  onChange={(e) => setLastFour(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Card Holder Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="As printed on card"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddCard} disabled={!bank || !holderName} className="flex-1">
                Add Card
              </Button>
              <Button variant="outline" onClick={() => setShowAddCard(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
