"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarketCode, MarketMover } from "@/lib/types";
import { DEFAULT_MARKET, MARKETS } from "@/lib/markets";
import MoverTable from "./MoverTable";
import SummaryCard from "./SummaryCard";

interface Props {
  token: string;
  username: string;
  onSignOut: () => void;
}

type Tab = "gainers" | "losers";

const AUTO_REFRESH_MS = 60_000;
const TOP_N = 15;

export default function Dashboard({ token, username, onSignOut }: Props) {
  const [market, setMarket] = useState<MarketCode>(DEFAULT_MARKET);
  const [movers, setMovers] = useState<MarketMover[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>("gainers");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/live?market=${market}`, {
        method: "GET",
        headers: { Authorization: token },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        movers?: MarketMover[];
        error?: string;
      };
      if (res.status === 401) {
        setError(data.error ?? "Session expired. Please sign in again.");
        onSignOut();
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setMovers(data.movers ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [market, token, onSignOut]);

  // initial load + refresh on market change
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  const gainers = useMemo(
    () =>
      [...movers]
        .filter((m) => m.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, TOP_N),
    [movers],
  );
  const losers = useMemo(
    () =>
      [...movers]
        .filter((m) => m.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, TOP_N),
    [movers],
  );
  const gainerCount = useMemo(
    () => movers.filter((m) => m.changePercent > 0).length,
    [movers],
  );
  const loserCount = useMemo(
    () => movers.filter((m) => m.changePercent < 0).length,
    [movers],
  );

  const lastRefreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString()
    : "Never";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800/70 bg-slate-950/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-white"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 17l6-6 4 4 8-8"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 7h7v7"
                />
              </svg>
            </div>
            <span className="font-semibold tracking-tight hidden sm:block">
              TickerChart Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="market" className="text-xs text-slate-400">
              Market
            </label>
            <select
              id="market"
              value={market}
              onChange={(e) => setMarket(e.target.value as MarketCode)}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MARKETS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-3 py-1.5 text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.93-2M4 15a8 8 0 0014.93 2"
              />
            </svg>
            Refresh
          </button>

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-brand-500"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto (60s)
          </label>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden md:inline">
              {username}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 px-3 py-1.5 text-sm transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Gainers"
              value={gainerCount}
              accent="green"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 17l6-6 4 4 8-8"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 7h7v7"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Losers"
              value={loserCount}
              accent="red"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7l6 6 4-4 8 8"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 17h7v-7"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Total tracked"
              value={movers.length}
              accent="slate"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              }
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setTab("gainers")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === "gainers"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Top Gainers
            </button>
            <button
              type="button"
              onClick={() => setTab("losers")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === "losers"
                  ? "border-rose-400 text-rose-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Top Losers
            </button>
          </div>

          <MoverTable
            movers={tab === "gainers" ? gainers : losers}
            emptyText={
              loading
                ? "Loading…"
                : tab === "gainers"
                  ? "No gainers in this market yet"
                  : "No losers in this market yet"
            }
          />
        </div>
      </main>

      {/* Status bar */}
      <footer className="border-t border-slate-800/70 bg-slate-950/60 backdrop-blur text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                loading
                  ? "bg-amber-400 animate-pulse"
                  : error
                    ? "bg-rose-500"
                    : "bg-emerald-500"
              }`}
            />
            {loading ? "Refreshing…" : error ? "Error" : "Live"}
          </div>
          <div>
            Last refresh:{" "}
            <span className="text-slate-200 tabular-nums">
              {lastRefreshLabel}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
