import { NextRequest, NextResponse } from "next/server";
import type { MarketMover } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE_URL_BASE =
  "https://tickerchart.com/tickerchart_live/live_loader_json_v3.php";

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return 0;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 },
    );
  }

  const market = (req.nextUrl.searchParams.get("market") ?? "EGY").toUpperCase();

  const url = `${LIVE_URL_BASE}?version=web_1.0.915&language=ARABIC&rand=${Date.now()}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: auth,
        Origin: "https://www.tickerchart.net",
        Referer: "https://www.tickerchart.net/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return NextResponse.json(
      { error: `Live data request failed: ${message}` },
      { status: 502 },
    );
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return NextResponse.json(
      { error: "Session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const text = await upstream.text();
  let raw: Record<string, unknown>;
  try {
    raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json(
      {
        error: `Unexpected live data response (status ${upstream.status})`,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Live data failed with status ${upstream.status}` },
      { status: upstream.status },
    );
  }

  const movers: MarketMover[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (!key.includes(".")) continue;
    const [symbol, mkt] = key.split(".");
    if (!mkt || mkt.toUpperCase() !== market) continue;
    if (!value || typeof value !== "object") continue;

    const entry = value as Record<string, unknown>;
    const price = toNumber(pick(entry, ["close", "price", "last", "c"]));
    const changePercent = toNumber(
      pick(entry, ["changePercent", "cp", "pcp", "changePct", "change_percent"]),
    );
    const change = toNumber(pick(entry, ["change", "ch", "chg"]));
    const volume = toNumber(pick(entry, ["volume", "vol", "v"]));
    const name =
      (pick(entry, ["name", "n", "nameEn", "nameAr"]) as string | undefined) ??
      symbol;

    if (!price && !changePercent && !volume) continue;

    movers.push({
      symbol,
      market: mkt.toUpperCase(),
      name: String(name),
      price,
      changePercent,
      change,
      volume,
    });
  }

  return NextResponse.json({ market, count: movers.length, movers });
}
