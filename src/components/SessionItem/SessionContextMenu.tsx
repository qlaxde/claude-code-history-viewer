import React, { useEffect, useMemo, useRef } from "react";
import { BookOpen, CircleOff, PauseCircle, PlayCircle, Skull, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunningSessionInfo, SessionStatus } from "@/types";
import { SESSION_STATUS_ICON } from "./sessionStatus";

interface SessionContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onSetStatus: (status: SessionStatus) => void;
  onSetPriority: (priority: 1 | 2 | 3 | 4 | 5) => void;
  onViewPlan?: () => void;
  onKillRunningSession?: () => void;
  runningSession?: RunningSessionInfo;
}

const STATUS_OPTIONS: Array<{
  status: SessionStatus;
  label: string;
  icon: React.ReactNode;
}> = [
  { status: "active", label: "Active", icon: <PlayCircle className="w-4 h-4" /> },
  { status: "paused", label: "Paused", icon: <PauseCircle className="w-4 h-4" /> },
  { status: "completed", label: "Completed", icon: <CircleOff className="w-4 h-4" /> },
  { status: "abandoned", label: "Abandoned", icon: <Skull className="w-4 h-4" /> },
];

export const SessionContextMenu: React.FC<SessionContextMenuProps> = ({
  position,
  onClose,
  onSetStatus,
  onSetPriority,
  onViewPlan,
  onKillRunningSession,
  runningSession,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const style = useMemo(() => {
    const width = 220;
    const height = 320;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;

    return {
      left: Math.max(viewportLeft + 12, Math.min(position.x, viewportLeft + viewportWidth - width - 12)),
      top: Math.max(viewportTop + 12, Math.min(position.y, viewportTop + viewportHeight - height - 12)),
    };
  }, [position]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[120] min-w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-xl"
      style={style}
    >
      <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Set status
      </div>
      <div className="space-y-0.5">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.status}
            type="button"
            onClick={() => {
              onSetStatus(option.status);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"
          >
            {option.icon}
            <span className="text-base leading-none">{SESSION_STATUS_ICON[option.status]}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="my-1 h-px bg-border" />

      <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Set priority
      </div>
      <div className="grid grid-cols-5 gap-1 px-1 pb-1">
        {[1, 2, 3, 4, 5].map((priority) => (
          <button
            key={priority}
            type="button"
            onClick={() => {
              onSetPriority(priority as 1 | 2 | 3 | 4 | 5);
              onClose();
            }}
            className="rounded-md border border-border/60 px-0 py-1 text-xs font-semibold hover:bg-accent/10"
          >
            {priority}
          </button>
        ))}
      </div>

      {(onViewPlan || onKillRunningSession) && <div className="my-1 h-px bg-border" />}

      {onViewPlan && (
        <button
          type="button"
          onClick={() => {
            onViewPlan();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"
        >
          <BookOpen className="w-4 h-4" />
          <span>View linked plan</span>
        </button>
      )}

      {runningSession && onKillRunningSession && (
        <button
          type="button"
          onClick={() => {
            onKillRunningSession();
            onClose();
          }}
          className={cn(
            "mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-destructive/10",
            "text-destructive"
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span>Kill session process (PID {runningSession.pid})</span>
        </button>
      )}
    </div>
  );
};
