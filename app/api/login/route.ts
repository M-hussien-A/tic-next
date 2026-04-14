import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_URL =
  "https://tickerchart.com/m/v2/tickerchart/web/login?version=web_1.0.915&language=ARABIC";

interface LoginBody {
  username?: string;
  password?: string;
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
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        error: `Unexpected login response (status ${upstream.status}): ${text.slice(0, 200)}`,
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

  const token = (data as { token?: string }).token;
  if (!token) {
    return NextResponse.json(
      { error: "Login succeeded but no token was returned" },
      { status: 502 },
    );
  }

  return NextResponse.json({ token });
}
