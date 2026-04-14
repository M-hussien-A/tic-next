"use client";

import type { MarketMover } from "@/lib/types";

interface Props {
  movers: MarketMover[];
  emptyText?: string;
}

function fmtNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVolume(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString();
}

export default function MoverTable({ movers, emptyText = "No data" }: Props) {
  if (movers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 py-14 text-center text-sm text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/70 text-slate-400">
              <th className="px-4 py-3 text-left font-medium w-10">#</th>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Change %</th>
              <th className="px-4 py-3 text-right font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {movers.map((m, i) => {
              const pos = m.changePercent > 0;
              const neg = m.changePercent < 0;
              const chgColor = pos
                ? "text-emerald-400"
                : neg
                  ? "text-rose-400"
                  : "text-slate-400";
              const chgBg = pos
                ? "bg-emerald-500/10"
                : neg
                  ? "bg-rose-500/10"
                  : "bg-slate-500/10";
              const sign = pos ? "+" : "";
              return (
                <tr
                  key={`${m.symbol}.${m.market}`}
                  className="border-t border-slate-800/70 hover:bg-slate-800/30 transition"
                >
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-100">
                    {m.symbol}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 max-w-[280px] truncate">
                    {m.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtNumber(m.price)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${chgColor} ${chgBg}`}
                    >
                      {sign}
                      {fmtNumber(m.changePercent)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {fmtVolume(m.volume)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
