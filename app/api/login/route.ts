import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_URL =
  "https://tickerchart.com/m/v2/tickerchart/web/login?version=web_1.0.915&language=ARABIC";

interface LoginBody {
  username?: string;
  password?: string;
}

const TOKEN_KEYS = [
  "token",
  "Token",
  "TcToken",
  "tcToken",
  "tc_token",
  "access_token",
  "accessToken",
  "auth_token",
  "authToken",
  "jwt",
  "sessionToken",
  "session_token",
];

/**
 * Walks an arbitrary JSON value and tries to find a TickerChart token.
 * Strategy:
 *  1. If any known token-ish key carries a non-empty string, return it.
 *  2. Otherwise, return the first string value that starts with "TcToken".
 */
function extractToken(value: unknown): string | null {
  const seen = new Set<object>();
  let tcPrefixed: string | null = null;

  const walk = (node: unknown): string | null => {
    if (node == null) return null;
    if (typeof node === "string") {
      if (!tcPrefixed && node.startsWith("TcToken")) {
        tcPrefixed = node;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    if (seen.has(node as object)) return null;
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        const t = walk(item);
        if (t) return t;
      }
      return null;
    }

    const obj = node as Record<string, unknown>;
    for (const key of TOKEN_KEYS) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
    for (const v of Object.values(obj)) {
      const t = walk(v);
      if (t) return t;
    }
    return null;
  };

  const keyed = walk(value);
  return keyed ?? tcPrefixed;
}

function topLevelShape(value: unknown): string {
  if (value == null || typeof value !== "object") return typeof value;
  if (Array.isArray(value)) return `array(len=${value.length})`;
  const keys = Object.keys(value as Record<string, unknown>).slice(0, 20);
  return `keys=[${keys.join(", ")}]`;
}

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  // TickerChart expects the password base64-encoded.
  const encodedPassword = Buffer.from(password, "utf-8").toString("base64");

  let upstream: Response;
  try {
    upstream = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.tickerchart.net",
        Referer: "https://www.tickerchart.net/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify({ username, password: encodedPassword }),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return NextResponse.json(
      { error: `Login failed: ${message}` },
      { status: 502 },
    );
  }

  const text = await upstream.text();

  // Some endpoints return the token as a bare string (e.g. "TcToken...") with
  // content-type text/plain — handle that before attempting JSON parse.
  const trimmed = text.trim();
  if (upstream.ok && trimmed.startsWith("TcToken")) {
    return NextResponse.json({ token: trimmed.replace(/^"|"$/g, "") });
  }

  let data: unknown;
  try {
    data = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    // Not JSON. If upstream says success, try to salvage a raw TcToken string.
    if (upstream.ok) {
      const match = trimmed.match(/TcToken[^"\s<>]+/);
      if (match) return NextResponse.json({ token: match[0] });
    }
    return NextResponse.json(
      {
        error: `Unexpected login response (status ${upstream.status}): ${trimmed.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const msg =
      (data as { message?: string; error?: string } | null)?.message ??
      (data as { message?: string; error?: string } | null)?.error ??
      `Login failed with status ${upstream.status}`;
    return NextResponse.json({ error: msg }, { status: upstream.status });
  }

  // TickerChart sometimes signals a failure with HTTP 200 + a status field.
  const statusField =
    (data as { status?: unknown; success?: unknown; ok?: unknown } | null) ??
    null;
  if (statusField) {
    const s = statusField.status;
    if (typeof s === "string" && /error|fail|invalid/i.test(s)) {
      const msg =
        (data as { message?: string; error?: string }).message ??
        (data as { message?: string; error?: string }).error ??
        `Login rejected: status=${s}`;
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (statusField.success === false || statusField.ok === false) {
      const msg =
        (data as { message?: string; error?: string }).message ??
        (data as { message?: string; error?: string }).error ??
        "Login rejected by TickerChart";
      return NextResponse.json({ error: msg }, { status: 401 });
    }
  }

  const token = extractToken(data);
  if (!token) {
    // Surface the response shape so misconfigurations are diagnosable without
    // leaking sensitive data (no values, just top-level keys).
    return NextResponse.json(
      {
        error:
          "Login response did not contain a recognizable token. Upstream shape: " +
          topLevelShape(data),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ token });
}
