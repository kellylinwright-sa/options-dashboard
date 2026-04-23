"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  Upload,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Wifi,
  RefreshCw,
  Lock,
  LockOpen,
} from "lucide-react";

const seedTrades: Trade[] = [
  {
    id: 1,
    symbol: "IBIT",
    side: "CALL",
    strike: 55,
    expiration: "2026-05-15",
    quantity: 1,
    entryPrice: 3.28,
    currentPrice: 0.18,
    exitPrice: null,
    status: "OPEN",
    openedAt: "2026-03-10",
    closedAt: null,
    notes: "5/15 · 1 buy",
    underlyingPrice: 49.7,
  },
  {
    id: 2,
    symbol: "OPEN",
    side: "CALL",
    strike: 11,
    expiration: "2026-05-15",
    quantity: 5,
    entryPrice: 0.96,
    currentPrice: 0.04,
    exitPrice: null,
    status: "OPEN",
    openedAt: "2026-03-06",
    closedAt: null,
    notes: "5/15 · 5 buys",
    underlyingPrice: 2.1,
  },
  {
    id: 3,
    symbol: "IREN",
    side: "CALL",
    strike: 55,
    expiration: "2026-07-17",
    quantity: 1,
    entryPrice: 3.43,
    currentPrice: 2.05,
    exitPrice: null,
    status: "OPEN",
    openedAt: "2026-03-01",
    closedAt: null,
    notes: "7/17 · 1 buy",
    underlyingPrice: 13.2,
  },
  {
    id: 4,
    symbol: "UUUU",
    side: "CALL",
    strike: 32,
    expiration: "2027-01-15",
    quantity: 1,
    entryPrice: 5.6,
    currentPrice: 2.8,
    exitPrice: null,
    status: "OPEN",
    openedAt: "2026-02-15",
    closedAt: null,
    notes: "1/15/2027 · 1 buy",
    underlyingPrice: 8.9,
  },
];

function money(value: number) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function percent(value: number) {
  const n = Number(value || 0);
  return `${n.toFixed(2)}%`;
}

type TradeStatus = "OPEN" | "CLOSED";
type TradeSide = "CALL" | "PUT";
type PositionDirection = "LONG" | "SHORT";
type Provider = "manual" | "tradier" | "finnhub";

type Trade = {
  id: number;
  symbol: string;
  side: TradeSide;
  strike: number;
  expiration: string;
  quantity: number;
  entryPrice: number;
  direction?: PositionDirection;
  currentPrice: number | null;
  exitPrice: number | null;
  status: TradeStatus;
  openedAt: string;
  closedAt: string | null;
  notes: string;
  underlyingPrice?: number;
};

type NewTradeForm = {
  symbol: string;
  side: TradeSide;
  direction: PositionDirection;
  strike: string;
  expiration: string;
  quantity: number | string;
  entryPrice: string;
  currentPrice: string;
  notes: string;
  underlyingPrice: string;
  openedAt: string;
};

type SellForm = {
  tradeId: number | null;
  quantitySold: number | string;
  exitPrice: number | string;
  closedAt: string;
};

function positionCost(trade: Trade): number | null {
  const entry = Number(trade.entryPrice);
  const qty = Number(trade.quantity);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(qty) || qty <= 0) return null;
  return entry * 100 * qty;
}

function positionValue(trade: Trade): number | null {
  const qty = Number(trade.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (trade.status === "CLOSED") {
    const ep = Number(trade.exitPrice);
    if (!Number.isFinite(ep) || ep < 0) return null;
    return ep * 100 * qty;
  }
  if (trade.currentPrice == null || !Number.isFinite(trade.currentPrice) || trade.currentPrice < 0) return null;
  return trade.currentPrice * 100 * qty;
}

function contractPnl(trade: Trade): number | null {
  const entry = Number(trade.entryPrice);
  const qty = Number(trade.quantity);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(qty) || qty <= 0) return null;
  const direction = trade.direction ?? "LONG";

  if (trade.status === "CLOSED") {
    const ep = Number(trade.exitPrice);
    if (!Number.isFinite(ep) || ep < 0) return null;
    return direction === "SHORT"
      ? (entry - ep) * qty * 100
      : (ep - entry) * qty * 100;
  }

  if (trade.currentPrice == null || !Number.isFinite(trade.currentPrice) || trade.currentPrice < 0) return null;
  return direction === "SHORT"
    ? (entry - trade.currentPrice) * qty * 100
    : (trade.currentPrice - entry) * qty * 100;
}

function returnPct(trade: Trade): number | null {
  const base = positionCost(trade);
  const pnl = contractPnl(trade);
  if (base == null || base === 0 || pnl == null) return null;
  return (pnl / base) * 100;
}

function normalizeTrade(raw: Trade): Trade {
  return {
    ...raw,
    symbol: String(raw.symbol || "").toUpperCase(),
    direction: raw.direction === "SHORT" ? "SHORT" : "LONG",
  };
}

function inRange(dateStr: string, range: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (range === "all") return true;
  const cutoff = new Date(now);
  if (range === "week") cutoff.setDate(cutoff.getDate() - 7);
  if (range === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  if (range === "three") cutoff.setMonth(cutoff.getMonth() - 3);
  return d >= cutoff && d <= now;
}

function formatOcc(dateString: string) {
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year.slice(-2)}`;
}

function buildOccSymbol(trade: Trade): string | null {
  const parts = trade.expiration.split("-");
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts;
  if (!/^\d{4}$/.test(yyyy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) {
    return null;
  }
  const yy = yyyy.slice(-2);
  const strikeInt = String(Math.round(Number(trade.strike) * 1000)).padStart(8, "0");
  return `${trade.symbol}${yy}${mm}${dd}${trade.side === "CALL" ? "C" : "P"}${strikeInt}`;
}

function getProviderLabel(provider: Provider) {
  if (provider === "tradier") return "Tradier";
  if (provider === "finnhub") return "Finnhub";
  return "Manual";
}

function createEmptyNewTrade(): NewTradeForm {
  return {
    symbol: "",
    side: "CALL",
    direction: "LONG",
    strike: "",
    expiration: "",
    quantity: 1,
    entryPrice: "",
    currentPrice: "",
    notes: "",
    underlyingPrice: "",
    openedAt: new Date().toISOString().slice(0, 10),
  };
}

function createEmptySellForm(): SellForm {
  return {
    tradeId: null,
    quantitySold: 1,
    exitPrice: "",
    closedAt: new Date().toISOString().slice(0, 10),
  };
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string | number | null;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card className="rounded-2xl border-amber-300 bg-amber-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-700 underline decoration-2 underline-offset-2">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value ?? "N/A"}</p>
            {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
          </div>
          <div className="rounded-2xl border p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionRow({
  trade,
  onSell,
  canEdit,
}: {
  trade: Trade;
  onSell: (tradeId: number) => void;
  canEdit: boolean;
}) {
  const pnl = contractPnl(trade);
  const positive = pnl !== null && pnl >= 0;
  const pct = returnPct(trade);
  const isOpen = trade.status === "OPEN";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-300 bg-sky-100 p-4">
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold text-blue-900 underline decoration-2 underline-offset-2">
          {trade.symbol} ${trade.strike} {trade.side}
        </div>
        <div className="mt-1 text-base font-semibold text-black">
          {formatOcc(trade.expiration)} · {trade.quantity}{" "}
          {trade.quantity === 1 ? "buy" : "buys"}
          {` · ${trade.direction ?? "LONG"}`}
          {trade.status === "CLOSED" && trade.closedAt
            ? ` · sold ${formatOcc(trade.closedAt)}`
            : ""}
        </div>
        <div className="mt-1 text-sm font-semibold text-black">
          Entry {money((Number(trade.entryPrice) || 0) * 100)}
          {trade.status === "CLOSED"
            ? ` · Exit ${money((Number(trade.exitPrice) || 0) * 100)}`
            : ` · Fair Value ${trade.currentPrice != null ? money(trade.currentPrice * 100) : "N/A"}`}
          {typeof trade.underlyingPrice === "number"
            ? ` · Stock ${money(trade.underlyingPrice)}`
            : ""}
        </div>
        <div className="mt-1 text-sm font-semibold text-black">
          <span
            className={`inline-block rounded px-1.5 py-0.5 font-medium ${
              trade.status === "OPEN"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {trade.status}
          </span>
          {trade.openedAt ? ` · Opened ${formatOcc(trade.openedAt)}` : ""}
          {trade.status === "CLOSED" && trade.closedAt
            ? ` · Closed ${formatOcc(trade.closedAt)}`
            : ""}
          {trade.status === "CLOSED" && trade.exitPrice != null
            ? ` · Exit Price ${money((Number(trade.exitPrice) || 0) * 100)}`
            : ""}
        </div>
        {trade.notes ? (
          <div className="mt-1 text-sm font-semibold text-black italic">{trade.notes}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div
            className={`text-2xl font-semibold ${
              pnl === null ? "text-slate-400" : positive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {pnl === null ? "N/A" : `${positive ? "+" : "-"}${money(Math.abs(pnl))}`}
          </div>
          <div
            className={`mt-1 text-lg ${
              pct === null ? "text-slate-400" : positive ? "text-emerald-600" : "text-orange-500"
            }`}
          >
            {pct === null ? "N/A" : `${positive ? "+" : ""}${percent(pct)}`}
          </div>
          <div className="mt-2 text-xs text-slate-500">Model P&L</div>
        </div>
        {isOpen ? (
          <Button variant="outline" onClick={() => onSell(trade.id)} disabled={!canEdit}>
            Sell / Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type OptionSnapshot = {
  currentPrice: number | null;
  underlyingPrice: number | null;
  optionSymbol: string | null;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mark: number | null;
  source: string;
};

type CloudSyncState = "checking" | "connected" | "readonly" | "offline" | "error";
type DashboardTab = "positions" | "closed" | "data";

const CLOUD_WRITE_KEY_STORAGE_KEY = "options-dashboard-cloud-write-key";

async function fetchOptionSnapshot({
  trade,
  provider,
  apiKey,
}: {
  trade: Trade;
  provider: Provider;
  apiKey: string;
}): Promise<OptionSnapshot> {
  if (!provider || provider === "manual") {
    return {
      currentPrice: trade.currentPrice,
      underlyingPrice: trade.underlyingPrice ?? null,
      optionSymbol: null,
      bid: null,
      ask: null,
      last: null,
      mark: null,
      source: "Manual",
    };
  }

  if (provider === "finnhub" && !apiKey) {
    throw new Error("Add an API key to use live prices.");
  }

  if (provider === "tradier") {
    const res = await fetch("/api/tradier/snapshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trade,
        apiKey: apiKey || undefined,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.error || "Tradier quote request failed.");
    }

    const data = await res.json();

    return {
      currentPrice: data.currentPrice != null ? Number(data.currentPrice) : null,
      underlyingPrice: data.underlyingPrice != null ? Number(data.underlyingPrice) : null,
      optionSymbol: data.optionSymbol ?? null,
      bid: data.bid != null ? Number(data.bid) : null,
      ask: data.ask != null ? Number(data.ask) : null,
      last: data.last != null ? Number(data.last) : null,
      mark: data.mark != null ? Number(data.mark) : null,
      source: data?.source || "Tradier",
    };
  }

  if (provider === "finnhub") {
    const stockRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(trade.symbol)}&token=${encodeURIComponent(apiKey)}`
    );

    if (!stockRes.ok) {
      throw new Error("Finnhub quote request failed.");
    }

    const stockQuote = await stockRes.json();
    const stockLast = Number(stockQuote?.c);

    if (!Number.isFinite(stockLast) || stockLast <= 0) {
      throw new Error(`Finnhub did not return a stock quote for ${trade.symbol}.`);
    }

    return {
      currentPrice: trade.currentPrice,
      underlyingPrice: stockLast,
      optionSymbol: null,
      bid: null,
      ask: null,
      last: null,
      mark: null,
      source: "Finnhub (stock only)",
    };
  }

  throw new Error("Unsupported provider.");
}

export default function OptionsTradeDashboard() {
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("positions");

  const [trades, setTrades] = useState<Trade[]>(seedTrades);
  const [rawJson, setRawJson] = useState(JSON.stringify(seedTrades, null, 2));
  const [hasHydrated, setHasHydrated] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [provider, setProvider] = useState<Provider>("manual");
  const [apiKey, setApiKey] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>("checking");
  const [cloudWriteKey, setCloudWriteKey] = useState("");
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [error, setError] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Manual");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [newTrade, setNewTrade] = useState<NewTradeForm>(createEmptyNewTrade());
  const [sellForm, setSellForm] = useState<SellForm>(createEmptySellForm());

  const cloudSyncLabel =
    cloudSyncState === "connected"
      ? "Cloud sync active"
      : cloudSyncState === "readonly"
        ? "Cloud sync read-only"
      : cloudSyncState === "checking"
        ? "Checking cloud sync"
        : cloudSyncState === "offline"
          ? "Cloud sync not configured"
          : "Cloud sync error";

  const cloudHealthBadgeClass =
    cloudSyncState === "connected"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : cloudSyncState === "readonly"
        ? "border-blue-300 bg-blue-50 text-blue-700"
      : cloudSyncState === "error"
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-amber-300 bg-amber-50 text-amber-800";

  const hasCloudWriteKey = cloudWriteKey.trim().length > 0;
  const editLockLabel =
    cloudSyncState === "offline"
      ? "Lock unavailable"
      : cloudSyncState === "checking"
        ? "Lock checking"
        : cloudSyncState === "readonly"
          ? "Locked"
          : hasCloudWriteKey
            ? "Unlocked"
            : "Locked";
  const EditLockIcon =
    cloudSyncState === "offline" || cloudSyncState === "checking" || cloudSyncState === "readonly" || !hasCloudWriteKey
      ? Lock
      : LockOpen;
  const editLockBadgeClass =
    cloudSyncState === "offline"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : cloudSyncState === "checking"
        ? "border-slate-300 bg-slate-50 text-slate-700"
        : cloudSyncState === "readonly" || !hasCloudWriteKey
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-emerald-300 bg-emerald-50 text-emerald-700";

  const filtered = useMemo(() => {
    return trades.filter((trade) => {
      const hay = `${trade.symbol} ${trade.side} ${trade.notes || ""}`.toLowerCase();
      const matchesSearch = hay.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" ? true : trade.status === statusFilter;
      const anchorDate =
        trade.status === "CLOSED" ? trade.closedAt || trade.openedAt : trade.openedAt;
      const matchesRange = inRange(anchorDate, range);
      return matchesSearch && matchesStatus && matchesRange;
    });
  }, [trades, search, statusFilter, range]);

  const openTrades = filtered.filter((t) => t.status === "OPEN");
  const closedTrades = filtered.filter((t) => t.status === "CLOSED");
  const wins = closedTrades.filter((t) => { const p = contractPnl(t); return p !== null && p > 0; });
  const losses = closedTrades.filter((t) => { const p = contractPnl(t); return p !== null && p < 0; });
  const totalPnl = filtered.reduce((sum, t) => { const p = contractPnl(t); return p !== null ? sum + p : sum; }, 0);
  const totalCost = filtered.reduce((sum, t) => { const c = positionCost(t); return c !== null ? sum + c : sum; }, 0);
  const totalValue = filtered.reduce((sum, t) => { const v = positionValue(t); return v !== null ? sum + v : sum; }, 0);
  const winRate = closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;
  const avgLoss = losses.length
    ? losses.reduce((sum, t) => { const p = contractPnl(t); return p !== null ? sum + p : sum; }, 0) / losses.length
    : 0;
  const totalReturn: number | null = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  const saveTradesRemote = useCallback(async (nextTrades: Trade[], savedAt: string) => {
    try {
      const trimmedWriteKey = cloudWriteKey.trim();
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(trimmedWriteKey ? { "x-cloud-write-key": trimmedWriteKey } : {}),
        },
        body: JSON.stringify({ trades: nextTrades, savedAt }),
      });

      if (res.ok) {
        setCloudSyncState("connected");
        return;
      }

      if (res.status === 403) {
        setCloudSyncState("readonly");
        return;
      }

      if (res.status === 503) {
        setCloudSyncState("offline");
        return;
      }

      setCloudSyncState("error");
    } catch {
      setCloudSyncState("error");
    }
  }, [cloudWriteKey]);

  async function loadTradesRemote() {
    try {
      const res = await fetch("/api/trades", { cache: "no-store" });
      if (!res.ok) {
        setCloudSyncState("error");
        return null;
      }

      const payload = await res.json();
      if (!payload?.cloud) {
        setCloudSyncState("offline");
        return null;
      }

      setCloudSyncState((current) => (current === "readonly" ? "readonly" : "connected"));

      if (!Array.isArray(payload?.trades)) {
        return null;
      }

      const normalized = (payload.trades as Trade[]).map(normalizeTrade);
      return {
        trades: normalized,
        savedAt: typeof payload.savedAt === "string" ? payload.savedAt : null,
      };
    } catch {
      setCloudSyncState("error");
      return null;
    }
  }

  const syncJson = useCallback((nextTrades: Trade[]) => {
    if (!hasCloudWriteKey) {
      setCloudSyncState("readonly");
      setError("Enter your owner key to edit dashboard data.");
      return false;
    }

    const normalized = nextTrades.map(normalizeTrade);
    setTrades(normalized);
    setRawJson(JSON.stringify(normalized, null, 2));

    try {
      localStorage.setItem("options-dashboard-trades", JSON.stringify(normalized));
      const now = new Date().toISOString();
      localStorage.setItem("options-dashboard-last-saved-at", now);
      setLastSavedAt(now);
      void saveTradesRemote(normalized, now);
      return true;
    } catch {
      // ignore storage errors
      return false;
    }
  }, [hasCloudWriteKey, saveTradesRemote]);

  async function handleForceCloudReload() {
    try {
      setSyncingCloud(true);
      setError("");

      const remote = await loadTradesRemote();
      if (!remote) {
        setError("Cloud data is not available. Check cloud sync configuration.");
        return;
      }

      setTrades(remote.trades);
      setRawJson(JSON.stringify(remote.trades, null, 2));
      localStorage.setItem("options-dashboard-trades", JSON.stringify(remote.trades));

      if (remote.savedAt) {
        setLastSavedAt(remote.savedAt);
        localStorage.setItem("options-dashboard-last-saved-at", remote.savedAt);
      }
    } catch {
      setError("Could not reload trades from cloud.");
    } finally {
      setSyncingCloud(false);
    }
  }

  function loadJson() {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON must be an array of trades");
      }
      if (!syncJson((parsed as Trade[]).map(normalizeTrade))) return;
      setError("");
    } catch (err) {
      setError(`Could not load data: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  function handleExportTrades() {
    const data = localStorage.getItem("options-dashboard-trades");

    if (!data) {
      alert("No trades to export");
      return;
    }

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "options-dashboard-trades.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  function handleImportTrades(event: React.ChangeEvent<HTMLInputElement>) {
    if (!hasCloudWriteKey) {
      setCloudSyncState("readonly");
      setError("Enter your owner key to import trades.");
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON must be an array of trades");
        }

        if (!syncJson((parsed as Trade[]).map(normalizeTrade))) return;
        setError("");
        alert("Trades imported and synced successfully");
      } catch {
        alert("Invalid file");
      }
    };

    reader.readAsText(file);
  }

  function updateNewTrade<K extends keyof NewTradeForm>(field: K, value: NewTradeForm[K]) {
    setNewTrade((prev) => ({ ...prev, [field]: value }));
  }

  function updateSellForm<K extends keyof SellForm>(field: K, value: SellForm[K]) {
    setSellForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddTrade() {
    if (!hasCloudWriteKey) {
      setCloudSyncState("readonly");
      setError("Enter your owner key to add positions.");
      return;
    }

    const quantity = Number(newTrade.quantity);
    const strike = Number(newTrade.strike);
    const entryPrice = Number(newTrade.entryPrice);
    const currentPrice = Number(newTrade.currentPrice || newTrade.entryPrice || 0);
    const underlyingPrice =
      newTrade.underlyingPrice === "" ? undefined : Number(newTrade.underlyingPrice);

    if (!newTrade.symbol || !newTrade.expiration || !quantity || !strike || Number.isNaN(entryPrice)) {
      setError("Fill in symbol, expiration, strike, quantity, and entry price.");
      return;
    }

    const nextTrade: Trade = {
      id: Date.now(),
      symbol: newTrade.symbol.trim().toUpperCase(),
      side: newTrade.side,
      direction: newTrade.direction,
      strike,
      expiration: newTrade.expiration,
      quantity,
      entryPrice,
      currentPrice,
      exitPrice: null,
      status: "OPEN",
      openedAt: newTrade.openedAt || new Date().toISOString().slice(0, 10),
      closedAt: null,
      notes:
        newTrade.notes ||
        `${formatOcc(newTrade.expiration)} · ${quantity} ${
          quantity === 1 ? "buy" : "buys"
        }`,
      underlyingPrice,
    };

    if (!syncJson([nextTrade, ...trades])) return;
    setNewTrade(createEmptyNewTrade());
    setIsAddOpen(false);
    setError("");
  }

  function openSellDialog(tradeId: number) {
    if (!hasCloudWriteKey) {
      setCloudSyncState("readonly");
      setError("Enter your owner key to close positions.");
      return;
    }

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    setSellForm({
      tradeId,
      quantitySold: trade.quantity,
      exitPrice: trade.currentPrice ?? "",
      closedAt: new Date().toISOString().slice(0, 10),
    });
    setIsSellOpen(true);
    setError("");
  }

  function handleSellTrade() {
    if (!hasCloudWriteKey) {
      setCloudSyncState("readonly");
      setError("Enter your owner key to close positions.");
      return;
    }

    const trade = trades.find((t) => t.id === sellForm.tradeId);
    if (!trade) {
      setError("Could not find that position.");
      return;
    }

    const quantitySold = Number(sellForm.quantitySold);
    const exitPrice = Number(sellForm.exitPrice);

    if (!quantitySold || quantitySold < 1 || quantitySold > trade.quantity) {
      setError("Sold quantity must be between 1 and the current open quantity.");
      return;
    }

    if (Number.isNaN(exitPrice)) {
      setError("Add a valid sale price.");
      return;
    }

    const remainingQty = trade.quantity - quantitySold;
    const closedRecord: Trade = {
      ...trade,
      id: Date.now(),
      quantity: quantitySold,
      exitPrice,
      status: "CLOSED",
      closedAt: sellForm.closedAt || new Date().toISOString().slice(0, 10),
      notes: `${trade.notes || ""} · sold ${quantitySold}`.trim(),
    };

    const nextTrades = trades.flatMap((item) => {
      if (item.id !== trade.id) return [item];

      if (remainingQty <= 0) {
        return [closedRecord];
      }

      const updatedOpen: Trade = {
        ...item,
        quantity: remainingQty,
        notes: `${formatOcc(item.expiration)} · ${remainingQty} ${
          remainingQty === 1 ? "buy" : "buys"
        }`,
      };

      return [updatedOpen, closedRecord];
    });

    if (!syncJson(nextTrades)) return;
    setSellForm(createEmptySellForm());
    setIsSellOpen(false);
    setError("");
  }

  const refreshPrices = useCallback(async () => {
    try {
      if (!hasCloudWriteKey) {
        setCloudSyncState("readonly");
        setError("Enter your owner key to update live prices.");
        return;
      }

      setRefreshing(true);
      setError("");

      const updated = await Promise.all(
  trades.map(async (trade) => {
    if (trade.status === "CLOSED") return trade;

    const snapshot = await fetchOptionSnapshot({ trade, provider, apiKey });

    const updatedTrade: Trade = {
      ...trade,
      currentPrice: snapshot.currentPrice != null ? Number(snapshot.currentPrice) : null,
      underlyingPrice:
        snapshot.underlyingPrice == null
          ? trade.underlyingPrice
          : Number(snapshot.underlyingPrice),
    };

    if (["HIMS", "IREN"].includes(trade.symbol)) {
      console.log(`[DEBUG ${trade.symbol}]`, {
        expectedOccSymbol: buildOccSymbol(trade),
        returnedOptionSymbol: snapshot.optionSymbol ?? "N/A",
        bid: snapshot.bid,
        ask: snapshot.ask,
        last: snapshot.last,
        mark: snapshot.mark,
        currentPrice: updatedTrade.currentPrice,
        pnl: contractPnl(updatedTrade),
        returnPct: returnPct(updatedTrade),
      });
    }

    return updatedTrade;
  })
);

      if (!syncJson(updated)) return;
      setSourceLabel(getProviderLabel(provider));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh prices.");
    } finally {
      setRefreshing(false);
    }
  }, [apiKey, hasCloudWriteKey, provider, syncJson, trades]);

  useEffect(() => {
  let mounted = true;

  async function hydrateTrades() {
    try {
      const remote = await loadTradesRemote();
      if (remote && mounted) {
        setTrades(remote.trades);
        setRawJson(JSON.stringify(remote.trades, null, 2));
        if (remote.savedAt) setLastSavedAt(remote.savedAt);
        localStorage.setItem("options-dashboard-trades", JSON.stringify(remote.trades));
        if (remote.savedAt) {
          localStorage.setItem("options-dashboard-last-saved-at", remote.savedAt);
        }
        return;
      }

      const stored = localStorage.getItem("options-dashboard-trades");
      const savedAt = localStorage.getItem("options-dashboard-last-saved-at");
      const storedCloudWriteKey = localStorage.getItem(CLOUD_WRITE_KEY_STORAGE_KEY);

      if (stored && mounted) {
        const parsed = (JSON.parse(stored) as Trade[]).map(normalizeTrade);
        setTrades(parsed);
        setRawJson(JSON.stringify(parsed, null, 2));
      }

      if (savedAt && mounted) {
        setLastSavedAt(savedAt);
      }

      if (storedCloudWriteKey && mounted) {
        setCloudWriteKey(storedCloudWriteKey);
      }
    } catch {
      // ignore parse/storage errors
    } finally {
      if (mounted) setHasHydrated(true);
    }
  }

  void hydrateTrades();

  return () => {
    mounted = false;
  };
}, []);

  useEffect(() => {
    if (!hasHydrated) return;

    try {
      if (cloudWriteKey.trim()) {
        localStorage.setItem(CLOUD_WRITE_KEY_STORAGE_KEY, cloudWriteKey.trim());
      } else {
        localStorage.removeItem(CLOUD_WRITE_KEY_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [cloudWriteKey, hasHydrated]);

  useEffect(() => {
    if (hasCloudWriteKey) return;
    setIsAddOpen(false);
    setIsSellOpen(false);
    setAutoRefresh(false);
    if (activeTab !== "data") return;
    setActiveTab("positions");
  }, [activeTab, hasCloudWriteKey]);

  useEffect(() => {
    if (!autoRefresh || provider === "manual") return;
    const timer = window.setInterval(() => {
      void refreshPrices();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, provider, refreshPrices]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl text-sm text-slate-500">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
              Options Tracker
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Real-Time Options Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              This version is built around your current option positions and can
              use live prices. Manual mode works immediately. For real-time
              marks, switch to Tradier and set TRADIER_API_KEY in your
              environment. Finnhub currently updates the underlying stock price
              only.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Badge variant="outline" className={cloudHealthBadgeClass}>
              Cloud Health: {cloudSyncLabel}
            </Badge>
            <Badge variant="outline" className={editLockBadgeClass}>
              <EditLockIcon className="mr-1 h-3.5 w-3.5" />
              Edit: {editLockLabel}
            </Badge>
            <div className="flex flex-wrap gap-2 md:justify-end">
            <Button
              variant={range === "week" ? "default" : "outline"}
              onClick={() => setRange("week")}
            >
              This Week
            </Button>
            <Button
              variant={range === "month" ? "default" : "outline"}
              onClick={() => setRange("month")}
            >
              1 Month
            </Button>
            <Button
              variant={range === "three" ? "default" : "outline"}
              onClick={() => setRange("three")}
            >
              3 Months
            </Button>
            <Button
              variant={range === "all" ? "default" : "outline"}
              onClick={() => setRange("all")}
            >
              All Time
            </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Open Positions" value={openTrades.length} icon={Activity} />
            <StatCard title="Portfolio Cost" value={money(totalCost)} icon={DollarSign} />
            <StatCard title="Current Value" value={money(totalValue)} icon={DollarSign} />
            <StatCard
              title="Total P&L"
              value={money(totalPnl)}
              icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total Return"
              value={totalReturn !== null ? percent(totalReturn) : null}
              icon={totalReturn !== null && totalReturn >= 0 ? TrendingUp : TrendingDown}
              hint="Model"
            />
            <StatCard
              title="Win Rate"
              value={percent(winRate)}
              icon={TrendingUp}
              hint="Closed trades only"
            />
            <StatCard title="Avg Loss" value={money(avgLoss)} icon={TrendingDown} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-900 font-sans">
          <Button onClick={() => setIsAddOpen(true)} disabled={!hasCloudWriteKey}>
            Add New Position
          </Button>

          <Button variant="outline" onClick={handleExportTrades}>
            Export Trades
          </Button>

          <Button variant="outline" onClick={handleForceCloudReload} disabled={syncingCloud}>
            {syncingCloud ? "Syncing Cloud..." : "Force Cloud Reload"}
          </Button>

          <div className="w-full max-w-sm md:mx-1">
            <Label className="mb-2 block text-slate-800">Cloud edit key (owner only)</Label>
            <div className="flex gap-2">
              <Input
                className="text-slate-900 placeholder:text-slate-500"
                value={cloudWriteKey}
                onChange={(e) => setCloudWriteKey(e.target.value)}
                placeholder="Enter CLOUD_WRITE_KEY to enable cloud edits"
                type="password"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloudWriteKey("")}
                disabled={!hasCloudWriteKey}
              >
                Clear Key
              </Button>
            </div>
          </div>

          <label
            className={`inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 ${
              hasCloudWriteKey ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            }`}
          >
            Import Trades
            <input
              type="file"
              accept="application/json"
              onChange={handleImportTrades}
              className="hidden"
              disabled={!hasCloudWriteKey}
            />
          </label>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add New Position</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Symbol</Label>
                  <Input
                    value={newTrade.symbol}
                    onChange={(e) => updateNewTrade("symbol", e.target.value)}
                    placeholder="IBIT"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Side</Label>
                  <Select
                    value={newTrade.side}
                    onValueChange={(value) => {
                      if (value) updateNewTrade("side", value as TradeSide);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">CALL</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Direction</Label>
                  <Select
                    value={newTrade.direction}
                    onValueChange={(value) => {
                      if (value) updateNewTrade("direction", value as PositionDirection);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LONG">LONG</SelectItem>
                      <SelectItem value="SHORT">SHORT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Strike</Label>
                  <Input
                    value={newTrade.strike}
                    onChange={(e) => updateNewTrade("strike", e.target.value)}
                    placeholder="55"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Expiration</Label>
                  <Input
                    value={newTrade.expiration}
                    onChange={(e) => updateNewTrade("expiration", e.target.value)}
                    type="date"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Quantity</Label>
                  <Input
                    value={newTrade.quantity}
                    onChange={(e) => updateNewTrade("quantity", e.target.value)}
                    type="number"
                    min="1"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Entry Price</Label>
                  <Input
                    value={newTrade.entryPrice}
                    onChange={(e) => updateNewTrade("entryPrice", e.target.value)}
                    placeholder="3.28"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Current Price</Label>
                  <Input
                    value={newTrade.currentPrice}
                    onChange={(e) => updateNewTrade("currentPrice", e.target.value)}
                    placeholder="0.18"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Underlying Price</Label>
                  <Input
                    value={newTrade.underlyingPrice}
                    onChange={(e) => updateNewTrade("underlyingPrice", e.target.value)}
                    placeholder="49.70"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Opened Date</Label>
                  <Input
                    value={newTrade.openedAt}
                    onChange={(e) => updateNewTrade("openedAt", e.target.value)}
                    type="date"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Notes</Label>
                  <Input
                    value={newTrade.notes}
                    onChange={(e) => updateNewTrade("notes", e.target.value)}
                    placeholder="5/15 · 1 buy"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTrade} disabled={!hasCloudWriteKey}>Save Position</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSellOpen} onOpenChange={setIsSellOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Sell or Close Position</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label className="mb-2 block">Quantity Sold</Label>
                  <Input
                    value={sellForm.quantitySold}
                    onChange={(e) => updateSellForm("quantitySold", e.target.value)}
                    type="number"
                    min="1"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Exit Price</Label>
                  <Input
                    value={sellForm.exitPrice}
                    onChange={(e) => updateSellForm("exitPrice", e.target.value)}
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Sold Date</Label>
                  <Input
                    value={sellForm.closedAt}
                    onChange={(e) => updateSellForm("closedAt", e.target.value)}
                    type="date"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSellOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSellTrade} disabled={!hasCloudWriteKey}>Confirm Sale</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {cloudSyncState === "offline" ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Cloud sync is not configured, so trades are saved only in this browser.
            Add BLOB_READ_WRITE_TOKEN in your deployment environment to persist trades across
            devices and sessions.
          </div>
        ) : null}

        {cloudSyncState === "readonly" ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Cloud data is shared in read-only mode. Enter your owner key in Cloud edit key to
            re-enable writes from this browser.
          </div>
        ) : null}

        {cloudSyncState === "error" ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Cloud sync encountered an error. Your latest changes are still saved in browser storage.
            Export trades as a backup while cloud sync is unavailable.
          </div>
        ) : null}

        <div className="mt-2 text-sm italic text-slate-500">
          {lastSavedAt
            ? `Saved locally at ${new Date(lastSavedAt).toLocaleTimeString()} · ${cloudSyncLabel} · Browser storage active`
            : `${cloudSyncLabel} · Browser storage active`}
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Wifi className="h-5 w-5" /> Live Price Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="mb-2 block">Price source</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => {
                    if (value) setProvider(value as Provider);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="tradier">Tradier API</SelectItem>
                    <SelectItem value="finnhub">Finnhub API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                {provider === "tradier" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    Using TRADIER_API_KEY from server environment (.env.local).
                    No copy/paste needed after setup.
                  </div>
                ) : (
                  <>
                    <Label className="mb-2 block">API key</Label>
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Paste your ${getProviderLabel(provider)} API key`}
                      type="password"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} disabled={!hasCloudWriteKey} />
                <Label>Auto-refresh every 30 seconds</Label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">Source: {sourceLabel}</Badge>
                {lastRefresh ? (
                  <span className="text-sm text-slate-500">
                    Last refresh: {lastRefresh.toLocaleTimeString()}
                  </span>
                ) : null}
                <Button onClick={refreshPrices} disabled={refreshing || !hasCloudWriteKey}>
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh Prices
                </Button>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {provider === "finnhub" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Finnhub is currently used for the underlying stock quote only.
                Option contract marks remain at your manual values in this dashboard.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbol, strike, notes"
                />
              </div>
              <div className="w-full md:w-56">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    if (value) setStatusFilter(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="OPEN">Open only</SelectItem>
                    <SelectItem value="CLOSED">Closed only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as DashboardTab)}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="positions">Current Positions</TabsTrigger>
            <TabsTrigger value="closed">Closed Trades</TabsTrigger>
            <TabsTrigger value="data" disabled={!hasCloudWriteKey}>Edit Your Data</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-3">
            {openTrades.length ? (
              openTrades.map((trade) => (
                <PositionRow
                  key={trade.id}
                  trade={trade}
                  onSell={openSellDialog}
                  canEdit={hasCloudWriteKey}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-slate-500">
                  No open positions in this view.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-3">
            {closedTrades.length ? (
              closedTrades.map((trade) => (
                <PositionRow
                  key={trade.id}
                  trade={trade}
                  onSell={openSellDialog}
                  canEdit={hasCloudWriteKey}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-slate-500">
                  No closed trades in this view.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="data">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Upload className="h-5 w-5" /> Paste your positions as JSON
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                  Required fields for live pricing: symbol, side, strike, expiration,
                  quantity, entryPrice, currentPrice, status. Optional: direction,
                  notes, openedAt, closedAt, underlyingPrice.
                </p>
                <Textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="min-h-[360px] font-mono text-xs"
                  disabled={!hasCloudWriteKey}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={loadJson} disabled={!hasCloudWriteKey}>Load Positions</Button>
                  <Button
                    variant="outline"
                    disabled={!hasCloudWriteKey}
                    onClick={() => {
                      if (!syncJson(seedTrades)) return;
                      setError("");
                    }}
                  >
                    Reset Demo Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
