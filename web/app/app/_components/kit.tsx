"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/// Shared visual pieces for the app: the logo, entrance animations, numbers, headers, stat cards, and empty states.

const EASE = [0.22, 1, 0.36, 1] as const;

/// The Sword logo: the mark, and the name next to it when asked.
export function Logo({ size = 32, withText = false, className }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {withText && <span className="text-[15px] font-semibold tracking-tight">Sword</span>}
    </span>
  );
}

/// The Sword mark: a sword pointing up and right on a violet tile. The same drawing as app/icon.svg (the favicon).
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("shrink-0 drop-shadow-[0_4px_12px_rgba(91,76,240,0.45)]", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#5b4cf0" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      <rect width="64" height="64" rx="16" fill={`url(#${id}-shine)`} />
      <g transform="rotate(45 32 32)">
        <path d="M32 6 L36.5 14 L36.5 38 L32 40 Z" fill="#fff" fillOpacity="0.78" />
        <path d="M32 6 L27.5 14 L27.5 38 L32 40 Z" fill="#fff" />
        <rect x="20" y="38" width="24" height="4.5" rx="2.25" fill="#fff" />
        <rect x="29.8" y="42" width="4.4" height="9.5" rx="1.6" fill="#fff" fillOpacity="0.9" />
        <circle cx="32" cy="54.5" r="3.4" fill="#fff" />
      </g>
      <circle cx="49" cy="15" r="2" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}

/// Fades and lifts its content in once, when it first renders.
export function FadeIn({ children, delay = 0, y = 8, className, ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/// A container whose `StaggerItem` children enter one after another.
export function Stagger({ children, className, delay = 0, gap = 0.06 }: { children: ReactNode; className?: string; delay?: number; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/// Counts up to a number when it scrolls into view, and animates between values after that. Always lands exactly on
/// the value, and whole numbers never show decimals on the way.
export function AnimatedNumber({ value, format, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  // What is on screen right now, so a new animation starts from there and never jumps or stalls.
  const current = useRef(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(current.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, inView, reduce]);

  const n = reduce ? value : shown;
  const text = format ? format(n) : (Number.isInteger(value) ? Math.round(n) : n).toLocaleString("en-US");
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

// ---------------------------------------------------------------- loading
// One family of loading pieces, used everywhere: a shimmering placeholder, placeholder rows for lists, a spinner
// for buttons, and a full loading state for pages and panels.

/// A placeholder block with a moving shine. Size it with className, like any box.
export function Shimmer({ className, rounded = "rounded-lg" }: { className?: string; rounded?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-shimmer bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklab,var(--muted),var(--foreground)_6%)_50%,var(--muted)_75%)] bg-[length:200%_100%]",
        rounded,
        className,
      )}
    />
  );
}

/// Placeholder rows for a list while it loads: an icon, two lines, and a value on the right.
export function LoadingRows({ count = 3, className, dense = false }: { count?: number; className?: string; dense?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-1", className)}>
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.06 }}
          className={cn("flex items-center gap-3 rounded-xl px-2", dense ? "py-2" : "py-3")}
        >
          <Shimmer className="size-8 shrink-0" rounded="rounded-xl" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3 w-2/5" />
            <Shimmer className="h-2.5 w-1/4" />
          </div>
          <Shimmer className="h-3.5 w-16" />
        </motion.div>
      ))}
    </div>
  );
}

/// The spinner for buttons and small inline waits.
export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-4 animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/// A full loading state for a page or a panel: the mark breathing, an orbit around it, and a short line of text.
export function LoadingState({ label = "Loading", className, compact = false }: { label?: string; className?: string; compact?: boolean }) {
  const size = compact ? 36 : 48;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center justify-center gap-4 text-center", compact ? "py-10" : "py-24", className)}
    >
      <div className="relative grid place-items-center" style={{ width: size + 28, height: size + 28 }}>
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand border-r-brand/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <motion.div animate={{ scale: [1, 0.92, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <Logo size={size} />
        </motion.div>
      </div>
      <p className="shimmer-text text-sm font-medium">{label}</p>
    </motion.div>
  );
}

/// Title row at the top of a section.
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <FadeIn className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {description && <p className="max-w-xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </FadeIn>
  );
}

type Tone = "brand" | "success" | "warning" | "info" | "neutral" | "destructive";

const TONES: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand ring-brand/15",
  success: "bg-success/10 text-success ring-success/15",
  warning: "bg-warning/12 text-warning ring-warning/20",
  info: "bg-info/10 text-info ring-info/15",
  neutral: "bg-muted text-muted-foreground ring-border",
  destructive: "bg-destructive/10 text-destructive ring-destructive/15",
};

/// A small rounded tile holding an icon, in one of the semantic tones.
export function IconChip({ icon: Icon, tone = "neutral", className, size = "md" }: { icon: LucideIcon; tone?: Tone; className?: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-7 rounded-lg" : size === "lg" ? "size-11 rounded-2xl" : "size-9 rounded-xl";
  const glyph = size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  return (
    <span className={cn("grid shrink-0 place-items-center ring-1 ring-inset", box, TONES[tone], className)}>
      <Icon className={glyph} aria-hidden />
    </span>
  );
}

/// One key number: label, value (animated), an icon, and an optional footnote or chart.
export function StatCard({
  label,
  value,
  format,
  suffix,
  icon,
  tone = "neutral",
  hint,
  children,
  className,
}: {
  label: string;
  /// Undefined while loading.
  value: number | undefined;
  format?: (n: number) => string;
  suffix?: string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn("group relative overflow-hidden surface-card p-5 transition-shadow hover:shadow-lift", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <IconChip icon={icon} tone={tone} size="sm" />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        {value === undefined ? (
          <Shimmer className="h-8 w-24" rounded="rounded-md" />
        ) : (
          <AnimatedNumber value={value} format={format} className="text-[28px] font-semibold leading-none tracking-tight" />
        )}
        {suffix && value !== undefined && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </motion.div>
  );
}

/// Shown when a list has nothing in it yet.
export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand/10 blur-xl" />
        <span className="grid size-12 place-items-center rounded-2xl border bg-card shadow-soft">
          <Icon className="size-5 text-muted-foreground" />
        </span>
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/// A row of options with a sliding highlight under the selected one.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: LucideIcon; count?: number }[];
  /// Unique per control on the page, so the highlight animates within it.
  id: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-xl border bg-muted/60 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-lg font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-background shadow-soft ring-1 ring-border dark:bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon && <o.icon className="size-3.5" />}
              {o.label}
              {o.count !== undefined && (
                <span className={cn("rounded-md px-1.5 text-[11px] tabular-nums", active ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground")}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/// A label and a value on one line, for detail lists.
export function DetailRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right", mono && "font-mono text-xs")}>{children}</span>
    </div>
  );
}

/// Big animated check mark for success moments.
export function SuccessMark({ size = 64 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="relative mx-auto grid place-items-center rounded-full bg-success/12 text-success"
      style={{ width: size, height: size }}
    >
      <motion.span
        className="absolute inset-0 rounded-full ring-2 ring-success/30"
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
      />
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.48, height: size * 0.48 }}>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

/// Soft animated colour glow behind hero sections.
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -left-1/4 -top-1/3 size-[70%] animate-aurora rounded-full bg-[radial-gradient(circle,oklch(0.6_0.2_285/0.22),transparent_60%)] blur-3xl" />
      <div className="absolute -bottom-1/3 -right-1/4 size-[70%] animate-aurora rounded-full bg-[radial-gradient(circle,oklch(0.7_0.14_200/0.16),transparent_60%)] blur-3xl [animation-delay:-6s]" />
    </div>
  );
}

/// One payment option: icon, title, and its action.
export function Method({ icon, title, subtitle, recommended, children }: { icon: React.ReactNode; title: string; subtitle: string; recommended?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-4 rounded-2xl border p-4 transition-shadow hover:shadow-soft", recommended && "border-brand/30 bg-brand/[0.03]")}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {recommended && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">Fastest</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
