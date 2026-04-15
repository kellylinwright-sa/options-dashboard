import { list, put } from "@vercel/blob";

type TradesPayload = {
  trades: unknown[];
  savedAt: string;
};

const BLOB_PATH = "options-dashboard/trades.json";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function fetchLatestTradesPayload(): Promise<TradesPayload | null> {
  const listed = await list({ prefix: BLOB_PATH });
  if (!listed.blobs.length) return null;

  const newest = listed.blobs
    .slice()
    .sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];

  if (!newest?.url) return null;

  const res = await fetch(newest.url, { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as Partial<TradesPayload>;
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
      access: "public",
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
