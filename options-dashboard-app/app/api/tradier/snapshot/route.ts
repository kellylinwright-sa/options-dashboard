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
  const parts = trade.expiration.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid expiration for ${trade.symbol}`);
  }

  const [yyyy, mm, dd] = parts;
  if (!/^\d{4}$/.test(yyyy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) {
    throw new Error(`Invalid expiration for ${trade.symbol}`);
  }

  const yy = yyyy.slice(-2);
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

    const returnedOptionSymbol =
      typeof optionQuote.symbol === "string" ? optionQuote.symbol : null;

    if (!returnedOptionSymbol || returnedOptionSymbol !== optionSymbol) {
      return Response.json(
        {
          error: `Option symbol mismatch. Expected ${optionSymbol}, received ${returnedOptionSymbol || "unknown"}.`,
        },
        { status: 409 }
      );
    }

    const rawBid =
      typeof optionQuote.bid === "number" && Number.isFinite(optionQuote.bid) && optionQuote.bid >= 0
        ? optionQuote.bid
        : null;
    const rawAsk =
      typeof optionQuote.ask === "number" && Number.isFinite(optionQuote.ask) && optionQuote.ask >= 0
        ? optionQuote.ask
        : null;
    const rawLast =
      typeof optionQuote.last === "number" && Number.isFinite(optionQuote.last) && optionQuote.last > 0
        ? optionQuote.last
        : null;
    const rawMark =
      typeof optionQuote.mark === "number" && Number.isFinite(optionQuote.mark) && optionQuote.mark > 0
        ? optionQuote.mark
        : null;

    const hasValidBidAsk =
      rawBid !== null && rawAsk !== null && rawAsk >= rawBid && rawAsk > 0;
    const markIsWithinSpread =
      rawMark !== null && hasValidBidAsk
        ? rawMark >= rawBid && rawMark <= rawAsk
        : rawMark !== null;

    let computedPrice: number | null = null;
    if (rawMark !== null && markIsWithinSpread) {
      computedPrice = rawMark;
    } else if (hasValidBidAsk) {
      computedPrice = (rawBid + rawAsk) / 2;
    } else if (rawLast !== null) {
      computedPrice = rawLast;
    }

    const rawStockLast =
      typeof stockQuote?.last === "number" && Number.isFinite(stockQuote.last) && stockQuote.last > 0
        ? stockQuote.last
        : null;

    console.log(
      "[Tradier] Success - computedPrice:", computedPrice,
      "bid:", rawBid, "ask:", rawAsk, "last:", rawLast, "mark:", rawMark,
      "underlying:", rawStockLast
    );
    return Response.json({
      optionSymbol: returnedOptionSymbol,
      currentPrice: computedPrice,
      underlyingPrice: rawStockLast,
      bid: rawBid,
      ask: rawAsk,
      last: rawLast,
      mark: rawMark,
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