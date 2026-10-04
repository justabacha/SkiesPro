import React from 'react';

export const DemoModeBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    role="status"
    className={`flex items-center gap-2 border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 ${
      compact ? 'rounded-lg px-2.5 py-1.5 text-[10px] font-bold' : 'rounded-xl px-4 py-3 text-sm font-semibold'
    }`}
  >
    <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white">
      DEMO
    </span>
    <span>Virtual funds only. No real money is at risk.</span>
  </div>
);
