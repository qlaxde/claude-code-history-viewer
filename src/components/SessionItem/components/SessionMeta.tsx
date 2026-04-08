import React from "react";
import { Clock, Hash, Wrench, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SessionMetaProps } from "../types";
import {
  SESSION_PRIORITY_CLASSES,
  SESSION_STATUS_CLASSES,
  SESSION_STATUS_ICON,
  SESSION_STATUS_LABELS,
} from "../sessionStatus";

export const SessionMeta: React.FC<SessionMetaProps> = ({
  session,
  isSelected,
  formatTimeAgo,
  status,
  priority,
  showProject = false,
  projectLabel,
  planTitle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1 ml-7 text-2xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {status && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              SESSION_STATUS_CLASSES[status]
            )}
          >
            <span>{SESSION_STATUS_ICON[status]}</span>
            <span>{SESSION_STATUS_LABELS[status]}</span>
          </span>
        )}
        {priority && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
              SESSION_PRIORITY_CLASSES[priority]
            )}
          >
            P{priority}
          </span>
        )}
        {showProject && projectLabel && (
          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {projectLabel}
          </span>
        )}
        {planTitle && (
          <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
            Plan · {planTitle}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
      <span
        className={cn(
          "flex items-center gap-1 font-mono",
          isSelected ? "text-accent/80" : "text-muted-foreground"
        )}
      >
        <span title={t("session.item.lastModified")}>
          <Clock className="w-3 h-3" />
        </span>
        {formatTimeAgo(session.last_modified)}
      </span>
      <span
        className={cn(
          "flex items-center gap-1 font-mono",
          isSelected ? "text-accent/80" : "text-muted-foreground"
        )}
      >
        <span title={t("session.item.messageCount")}>
          <Hash className="w-3 h-3" />
        </span>
        {session.message_count}
      </span>
      {session.storage_type && (
        <span
          className={cn(
            "px-1 py-0.5 rounded font-medium uppercase",
            isSelected
              ? "text-accent/80 bg-accent/10"
              : "text-muted-foreground bg-muted/50"
          )}
        >
          {t(`session.item.storageType.${session.storage_type}`)}
        </span>
      )}
      {session.has_tool_use && (
        <span title={t("session.item.containsToolUse")}>
          <Wrench
            className={cn(
              "w-3 h-3",
              isSelected ? "text-accent" : "text-accent/50"
            )}
          />
        </span>
      )}
      {session.has_errors && (
        <span title={t("session.item.containsErrors")}>
          <AlertTriangle className="w-3 h-3 text-destructive" />
        </span>
      )}
      </div>
    </div>
  );
};
