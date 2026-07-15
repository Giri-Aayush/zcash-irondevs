"use client";

export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`label flex-1 rounded-md px-2.5 py-1.5 transition-colors ${
              on ? "bg-gold/[0.13] text-gold" : "text-foreground/45 hover:text-foreground/80"
            }`}
            style={{ letterSpacing: "0.13em" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
