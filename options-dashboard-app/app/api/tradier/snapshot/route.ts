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
    const body = (await request.json()) as SnapshotBody;
    const trade = body?.trade;

    if (!trade?.symbol || !trade.expiration || !trade.side || !trade.strike) {
      return Response.json({ error: "Missing required trade fields." }, { status: 400 });
    }

    const apiKey = (body?.apiKey || process.env.TRADIER_API_KEY || "").trim();
    if (!apiKey) {
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

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `Tradier quote request failed (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const quotes = Array.isArray(json?.quotes?.quote)
      ? json.quotes.quote
      : [json?.quotes?.quote].filter(Boolean);

    const optionQuote = quotes.find(
      (q: { symbol?: string }) => q?.symbol === optionSymbol
    );
    const stockQuote = quotes.find(
      (q: { symbol?: string }) => q?.symbol === trade.symbol.toUpperCase()
    );

    if (!optionQuote) {
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

    return Response.json({
      currentPrice: Number(mark ?? trade.currentPrice ?? 0),
      underlyingPrice: Number(stockQuote?.last ?? trade.underlyingPrice ?? 0),
      source: "Tradier",
    });
  } catch (error) {
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