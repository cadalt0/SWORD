"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

/// Small building blocks for the landing page: reveal on scroll, tilt on hover, glowing borders, and headings.

/// Fades and lifts its content in when it scrolls into view.
export function Reveal({ children, delay = 0, y = 24, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/// A card that tilts toward the cursor and shows a soft light where the cursor is.
export function TiltCard({ children, className, glow = "rgba(139,92,246,0.35)" }: { children: ReactNode; className?: string; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 200, damping: 20 });
  const lx = useTransform(mx, (v) => `${v * 100}%`);
  const ly = useTransform(my, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(420px circle at ${lx} ${ly}, ${glow}, transparent 60%)`;

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className={cn("group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl", className)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: light }} />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

/// A section's eyebrow, title and lead.
export function Heading({ eyebrow, title, lead, center = true, className }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean; className?: string }) {
  return (
    <Reveal className={cn("max-w-3xl space-y-4", center && "mx-auto text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200/80">
        <span className="size-1.5 rounded-full bg-gradient-to-r from-violet-400 to-sky-400" />
        {eyebrow}
      </span>
      <h2 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">{title}</h2>
      {lead && <p className="text-pretty text-lg leading-relaxed text-white/60">{lead}</p>}
    </Reveal>
  );
}

/// Text in the moving brand gradient.
export function Gradient({ children }: { children: ReactNode }) {
  return <span className="animate-shine bg-[linear-gradient(110deg,#c4b5fd,45%,#ffffff,55%,#7dd3fc)] bg-[length:250%_100%] bg-clip-text text-transparent">{children}</span>;
}

/// A row that scrolls sideways forever.
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]", className)}>
      <div className="flex shrink-0 animate-marquee items-center gap-4 pr-4">{children}</div>
      <div aria-hidden className="flex shrink-0 animate-marquee items-center gap-4 pr-4">
        {children}
      </div>
    </div>
  );
}

/// A floating glass card, for the hero's payment notifications.
export function FloatCard({ children, className, delay = 0, distance = 10 }: { children: ReactNode; className?: string; delay?: number; distance?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6 + delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -distance, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-full border border-white/12 bg-white/[0.06] p-1.5 pr-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
