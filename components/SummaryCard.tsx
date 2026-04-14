"use client";

interface Props {
  label: string;
  value: number | string;
  accent: "green" | "red" | "slate";
  icon?: React.ReactNode;
}

const ACCENTS = {
  green: {
    ring: "ring-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  red: {
    ring: "ring-rose-500/20",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
  },
  slate: {
    ring: "ring-slate-500/20",
    bg: "bg-slate-500/10",
    text: "text-slate-300",
  },
};

export default function SummaryCard({ label, value, accent, icon }: Props) {
  const a = ACCENTS[accent];
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-4 ring-1 ${a.ring}`}
    >
      <div className={`h-11 w-11 rounded-lg ${a.bg} ${a.text} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${a.text}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
