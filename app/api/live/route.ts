import { NextRequest, NextResponse } from "next/server";
import type { MarketMover } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE_URL_BASE =
  "https://tickerchart.com/tickerchart_live/live_loader_json_v3.php";

const PRICE_KEYS = ["close", "price", "last", "c", "Close", "lastPrice"];
const CHANGE_PCT_KEYS = [
  "changePercent",
  "cp",
  "pcp",
  "changePct",
  "change_percent",
  "percentChange",
  "chgPct",
];
const CHANGE_KEYS = ["change", "ch", "chg", "priceChange"];
const VOLUME_KEYS = ["volume", "vol", "v", "totalVolume"];
const NAME_KEYS = ["name", "n", "nameEn", "nameAr", "symbolName", "description"];
const SYMBOL_KEYS = ["symbol", "sym", "code", "ticker"];
const MARKET_KEYS = ["market", "m", "mkt", "exchange", "ex"];

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

function looksLikeMover(entry: Record<string, unknown>): boolean {
  // An entry looks like market data if it has at least one numeric price-ish
  // field AND one of: change, changePercent, volume.
  const hasPrice = PRICE_KEYS.some((k) => entry[k] !== undefined);
  const hasChange =
    CHANGE_KEYS.some((k) => entry[k] !== undefined) ||
    CHANGE_PCT_KEYS.some((k) => entry[k] !== undefined) ||
    VOLUME_KEYS.some((k) => entry[k] !== undefined);
  return hasPrice && hasChange;
}

interface RawEntry {
  key: string;
  entry: Record<string, unknown>;
}

function collectEntries(root: unknown): RawEntry[] {
  const out: RawEntry[] = [];
  const seen = new Set<object>();

  const walk = (node: unknown) => {
    if (node == null || typeof node !== "object") return;
    if (seen.has(node as object)) return;
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const obj = node as Record<string, unknown>;

    // Is THIS object a dictionary of mover entries?
    let moverCount = 0;
    const children: RawEntry[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const child = v as Record<string, unknown>;
        if (looksLikeMover(child)) {
          moverCount++;
          children.push({ key: k, entry: child });
        }
      }
    }
    if (moverCount >= 3) {
      // Treat this object as a flat mover dict.
      out.push(...children);
      return;
    }

    // Otherwise recurse into children.
    for (const v of Object.values(obj)) walk(v);
  };

  walk(root);
  return out;
}

function splitKey(key: string): { symbol: string; market: string | null } {
  // Handles "COMI.EGY", "COMI_EGY", "COMI:EGY", "COMI-EGY", or just "COMI".
  const m = key.match(/^([^.:_\-\s]+)[.:_\-\s]([A-Za-z]{2,6})$/);
  if (m) return { symbol: m[1], market: m[2].toUpperCase() };
  return { symbol: key, market: null };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 },
    );
  }

  const requestedMarket = (
    req.nextUrl.searchParams.get("market") ?? "EGY"
  ).toUpperCase();
  const debug = req.nextUrl.searchParams.get("debug") === "1";

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
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        error: `Unexpected live data response (status ${upstream.status}): ${text.slice(0, 200)}`,
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

  const rawEntries = collectEntries(raw);

  // Discover which markets the response contains, either from key suffixes or
  // embedded market fields.
  const marketsFound = new Set<string>();
  for (const { key, entry } of rawEntries) {
    const { market: km } = splitKey(key);
    if (km) marketsFound.add(km);
    const em = pick(entry, MARKET_KEYS);
    if (typeof em === "string" && em) marketsFound.add(em.toUpperCase());
  }

  const movers: MarketMover[] = [];
  for (const { key, entry } of rawEntries) {
    const split = splitKey(key);
    const embeddedMarket = (() => {
      const v = pick(entry, MARKET_KEYS);
      return typeof v === "string" && v ? v.toUpperCase() : null;
    })();
    const entryMarket = split.market ?? embeddedMarket;

    // If the response only contains one market (or none encoded), trust the
    // requested market. Otherwise filter by match.
    const keep =
      entryMarket === null || entryMarket === requestedMarket;
    if (!keep) continue;

    const symbol =
      (pick(entry, SYMBOL_KEYS) as string | undefined) ?? split.symbol;
    const price = toNumber(pick(entry, PRICE_KEYS));
    const changePercent = toNumber(pick(entry, CHANGE_PCT_KEYS));
    const change = toNumber(pick(entry, CHANGE_KEYS));
    const volume = toNumber(pick(entry, VOLUME_KEYS));
    const name =
      (pick(entry, NAME_KEYS) as string | undefined) ?? String(symbol);

    if (!price && !changePercent && !volume) continue;

    movers.push({
      symbol: String(symbol),
      market: entryMarket ?? requestedMarket,
      name,
      price,
      changePercent,
      change,
      volume,
    });
  }

  const payload: Record<string, unknown> = {
    market: requestedMarket,
    count: movers.length,
    movers,
  };

  if (movers.length === 0 || debug) {
    // Diagnostic block so empty results can be explained in the UI.
    const sampleKeys = rawEntries.slice(0, 5).map((e) => e.key);
    const sampleEntry = rawEntries[0]?.entry
      ? Object.keys(rawEntries[0].entry).slice(0, 20)
      : [];
    const topLevelKeys =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.keys(raw as Record<string, unknown>).slice(0, 20)
        : [];
    payload.debug = {
      rawEntryCount: rawEntries.length,
      marketsFound: Array.from(marketsFound).sort(),
      sampleKeys,
      sampleEntryFields: sampleEntry,
      topLevelKeys,
      upstreamBytes: text.length,
    };
  }

  return NextResponse.json(payload);
}
