import { get, put } from "@vercel/blob";

type TradesPayload = {
  trades: unknown[];
  savedAt: string;
};

const BLOB_PATH = "options-dashboard/trades.json";
const BLOB_ACCESS = process.env.BLOB_ACCESS === "private" ? "private" : "public";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function fetchLatestTradesPayload(): Promise<TradesPayload | null> {
  const blob = await get(BLOB_PATH, {
    access: BLOB_ACCESS,
  });
  if (!blob) return null;

  const json = (await blob.blob.json()) as Partial<TradesPayload>;
  if (!Array.isArray(json?.trades)) return null;

  return {
    trades: json.trades,
    savedAt:
      typeof json.savedAt === "string" && json.savedAt
        ? json.savedAt
        : new Date().toISOString(),
  };
}

export async function GET() {
  try {
    if (!hasBlobToken()) {
      return Response.json({ trades: null, savedAt: null, cloud: false });
    }

    const payload = await fetchLatestTradesPayload();
    if (!payload) {
      return Response.json({ trades: null, savedAt: null, cloud: true });
    }

    return Response.json({ ...payload, cloud: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load cloud trades.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!hasBlobToken()) {
      return Response.json(
        {
          error:
            "Cloud sync is not configured. Set BLOB_READ_WRITE_TOKEN in your environment.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Partial<TradesPayload>;
    if (!Array.isArray(body?.trades)) {
      return Response.json({ error: "'trades' must be an array." }, { status: 400 });
    }

    const payload: TradesPayload = {
      trades: body.trades,
      savedAt:
        typeof body.savedAt === "string" && body.savedAt
          ? body.savedAt
          : new Date().toISOString(),
    };

    const result = await put(BLOB_PATH, JSON.stringify(payload), {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });

    return Response.json({ ok: true, savedAt: payload.savedAt, url: result.url });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not save cloud trades.",
      },
      { status: 500 }
    );
  }
}
