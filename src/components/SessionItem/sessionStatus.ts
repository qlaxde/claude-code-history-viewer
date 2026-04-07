import type { SessionPriority, SessionStatus } from "@/types";

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  active: "active",
  paused: "paused",
  completed: "completed",
  abandoned: "abandoned",
};

export const SESSION_STATUS_ICON: Record<SessionStatus, string> = {
  active: "🟢",
  paused: "🟡",
  completed: "✅",
  abandoned: "⬜",
};

export const SESSION_STATUS_CLASSES: Record<SessionStatus, string> = {
  active: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/12 text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/12 text-blue-400 border-blue-500/30",
  abandoned: "bg-muted text-muted-foreground border-border/50",
};

export const SESSION_PRIORITY_CLASSES: Record<SessionPriority, string> = {
  1: "bg-red-500/15 text-red-300 border-red-500/30",
  2: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  3: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  4: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  5: "bg-muted text-muted-foreground border-border/50",
};
