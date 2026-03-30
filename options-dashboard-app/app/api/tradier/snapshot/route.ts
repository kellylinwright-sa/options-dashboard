type TradeSide = "CALL" | "PUT";

type SnapshotTrade = {
  symbol: string;
  side: TradeSide;
  strike: number;
  expiration: string;
  currentPrice?: number;
  underlyingPrice?: number;
};

type SnapshotBody = {
  trade?: SnapshotTrade;
  apiKey?: string;
};

function createOccOptionSymbol(trade: SnapshotTrade) {
  const occ = new Date(trade.expiration);
  if (Number.isNaN(occ.getTime())) {
    throw new Error(`Invalid expiration for ${trade.symbol}`);
  }

  const yy = String(occ.getFullYear()).slice(-2);
  const mm = String(occ.getMonth() + 1).padStart(2, "0");
  const dd = String(occ.getDate()).padStart(2, "0");
  const strikeInt = String(Math.round(Number(trade.strike) * 1000)).padStart(
    8,
    "0"
  );

  return `${trade.symbol}${yy}${mm}${dd}${
    trade.side === "CALL" ? "C" : "P"
  }${strikeInt}`;
}

export async function POST(request: Request) {
  try {
    console.log("[Tradier] Request started");
    const body = (await request.json()) as SnapshotBody;
    const trade = body?.trade;
    console.log("[Tradier] Trade symbol:", trade?.symbol);

    if (!trade?.symbol || !trade.expiration || !trade.side || !trade.strike) {
      console.log("[Tradier] Missing trade fields");
      return Response.json({ error: "Missing required trade fields." }, { status: 400 });
    }

    const apiKey = (body?.apiKey || process.env.TRADIER_API_KEY || "").trim();
    console.log("[Tradier] API key from env:", process.env.TRADIER_API_KEY ? "found" : "NOT FOUND");
    console.log("[Tradier] API key from body:", body?.apiKey ? "provided" : "not provided");
    
    if (!apiKey) {
      console.log("[Tradier] No API key available");
      return Response.json(
        {
          error:
            "Tradier key not set. Add TRADIER_API_KEY to .env.local or provide apiKey in request body.",
        },
        { status: 400 }
      );
    }

    const baseUrl = (process.env.TRADIER_BASE_URL || "https://api.tradier.com").trim();
    const optionSymbol = createOccOptionSymbol(trade);
    const symbols = `${optionSymbol},${trade.symbol.toUpperCase()}`;
    console.log("[Tradier] Fetching symbols:", symbols, "from", baseUrl);

    const res = await fetch(
      `${baseUrl}/v1/markets/quotes?symbols=${encodeURIComponent(symbols)}&greeks=true`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    console.log("[Tradier] Response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.log("[Tradier] Error response:", text.slice(0, 200));
      return Response.json(
        { error: `Tradier quote request failed (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    console.log("[Tradier] Response received, quotes count:", Array.isArray(json?.quotes?.quote) ? json.quotes.quote.length : 1);
    const quotes = Array.isArray(json?.quotes?.quote)
      ? json.quotes.quote
      : [json?.quotes?.quote].filter(Boolean);

    const optionQuote = quotes.find(
      (q: { symbol?: string }) => q?.symbol === optionSymbol
    );
    const stockQuote = quotes.find(
      (q: { symbol?: string }) => q?.symbol === trade.symbol.toUpperCase()
    );
    console.log("[Tradier] Option quote found:", !!optionQuote, "Stock quote found:", !!stockQuote);

    if (!optionQuote) {
      console.log("[Tradier] Option quote missing for", optionSymbol);
      return Response.json(
        { error: `No option quote found for ${optionSymbol}.` },
        { status: 404 }
      );
    }

    const hasBidAsk = [optionQuote.bid, optionQuote.ask].every(
      (v) => typeof v === "number"
    );
    const mark = hasBidAsk
      ? (optionQuote.bid + optionQuote.ask) / 2
      : optionQuote.last ?? trade.currentPrice ?? 0;

    console.log("[Tradier] Success - mark:", mark, "underlying:", stockQuote?.last);
    return Response.json({
      currentPrice: Number(mark ?? trade.currentPrice ?? 0),
      underlyingPrice: Number(stockQuote?.last ?? trade.underlyingPrice ?? 0),
      source: "Tradier",
    });
  } catch (error) {
    console.log("[Tradier] Exception:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Tradier snapshot.",
      },
      { status: 500 }
    );
  }
}