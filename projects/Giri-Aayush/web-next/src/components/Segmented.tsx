"use client";

import { useId } from "react";
import { motion } from "motion/react";

export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const uid = useId();
  return (
    <div className="relative flex gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`label relative flex-1 rounded-md px-2.5 py-1.5 transition-colors ${
              on ? "text-gold" : "text-foreground/45 hover:text-foreground/80"
            }`}
            style={{ letterSpacing: "0.13em" }}
          >
            {/* the active pill slides between options with a spring */}
            {on && (
              <motion.span
                layoutId={`seg-${uid}-active`}
                className="absolute inset-0 -z-0 rounded-md bg-gold/[0.13] ring-1 ring-gold/20"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
