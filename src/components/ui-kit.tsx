import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("surface rounded-2xl p-3.5", className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <h2 className="font-display text-lg uppercase tracking-wide">{children}</h2>
      {right ? <span className="label-mono">{right}</span> : null}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "ghost" | "outline" | "gold" | "outlineNoir";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[opacity,transform] active:scale-[0.98] disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "accent" && "bg-accent text-accent-foreground",
        variant === "outline" && "border border-border bg-card text-foreground",
        variant === "gold" && "bg-gold text-noir hover:brightness-110",
        variant === "outlineNoir" && "border border-gold/30 bg-noir text-paper hover:border-gold/60",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  dark,
}: {
  label: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <label className="block">
      <span className={dark ? "label-mono-light" : "label-mono"}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const controlCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlCls, className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlCls, className)} />;
}

export function Bar({ ratio, tone }: { ratio: number; tone: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <div
        className={cn("animate-fillbar h-full rounded-full", tone)}
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
      />
    </div>
  );
}

export function Tag({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "clay" | "blue" | "brown" | "green";
}) {
  const tones: Record<string, string> = {
    muted: "bg-foreground/5 text-muted-foreground",
    clay: "bg-clay/15 text-clay",
    blue: "bg-blue/15 text-blue",
    brown: "bg-brown/15 text-brown",
    green: "bg-green/15 text-green",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}
