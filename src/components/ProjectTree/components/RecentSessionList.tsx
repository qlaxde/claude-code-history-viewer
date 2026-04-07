import React, { useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionItem } from "@/components/SessionItem";
import { useAllSessions } from "@/hooks/useAllSessions";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { ClaudeProject, ClaudeSession, SessionStatus } from "@/types";

interface RecentSessionListProps {
  projects: ClaudeProject[];
  selectedSession: ClaudeSession | null;
  onSessionSelect: (session: ClaudeSession) => void;
  onSessionHover?: (session: ClaudeSession) => void;
  formatTimeAgo: (date: string) => string;
  statusFilter?: "all" | SessionStatus;
}

type BucketKey = "today" | "yesterday" | "week" | "month" | "older";

function getLocaleWeekStart(locale?: string): number {
  try {
    const localeInfo = new Intl.Locale(locale ?? "en-US");
    return (localeInfo as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

function getBucket(dateString: string, locale?: string): BucketKey {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const firstDayOfWeek = getLocaleWeekStart(locale) % 7;
  const startOfWeek = new Date(startOfToday);
  const daysSinceWeekStart = (startOfWeek.getDay() - firstDayOfWeek + 7) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceWeekStart);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfWeek) return "week";
  if (date >= startOfMonth) return "month";
  return "older";
}

const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "week", "month", "older"];

export const RecentSessionList: React.FC<RecentSessionListProps> = ({
  projects,
  selectedSession,
  onSessionSelect,
  onSessionHover,
  formatTimeAgo,
  statusFilter = "all",
}) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const { sessions, isLoading, error } = useAllSessions(projects);
  const { getSessionDisplayName, userMetadata, plans } = useAppStore();

  const planTitleMap = useMemo(
    () => new Map(plans.items.map((plan) => [plan.slug, plan.title])),
    [plans.items]
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sessions
      .filter((session) => {
        const status = userMetadata.sessions[session.session_id]?.status;
        if (statusFilter !== "all" && status !== statusFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const displayName = getSessionDisplayName(session.session_id, session.summary) ?? "";
        const planTitle = (session.slug && planTitleMap.get(session.slug)) || "";
        return (
          displayName.toLowerCase().includes(query) ||
          (session.summary ?? "").toLowerCase().includes(query) ||
          session.session_id.toLowerCase().includes(query) ||
          session.project_name.toLowerCase().includes(query) ||
          planTitle.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.last_message_time.localeCompare(a.last_message_time));
  }, [getSessionDisplayName, planTitleMap, searchQuery, sessions, statusFilter, userMetadata.sessions]);

  const groupedSessions = useMemo(() => {
    const buckets = new Map<BucketKey, ClaudeSession[]>();
    for (const bucket of BUCKET_ORDER) {
      buckets.set(bucket, []);
    }

    for (const session of filteredSessions) {
      buckets.get(getBucket(session.last_message_time, i18n.resolvedLanguage || i18n.language))?.push(session);
    }

    return buckets;
  }, [filteredSessions, i18n.language, i18n.resolvedLanguage]);

  if (isLoading && sessions.length === 0) {
    return (
      <div className="px-3 py-2 space-y-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2 rounded-xl border border-border/40 bg-card/20 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-3">
      <div className="px-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-8 pl-8 text-xs"
            placeholder={t("session.filter.searchPlaceholder", "Search sessions...")}
          />
        </div>
      </div>

      {error && (
        <div className="px-3 text-xs text-destructive">{error}</div>
      )}

      {filteredSessions.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("session.filter.noResults", "No matching sessions")}
        </div>
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const bucketSessions = groupedSessions.get(bucket) ?? [];
          if (bucketSessions.length === 0) {
            return null;
          }

          return (
            <section key={bucket} className="space-y-1">
              <div className="sticky top-0 z-10 mx-2 rounded-lg border border-border/40 bg-background/85 px-3 py-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {bucket === "today"
                      ? "Today"
                      : bucket === "yesterday"
                        ? "Yesterday"
                        : bucket === "week"
                          ? "This Week"
                          : bucket === "month"
                            ? "This Month"
                            : "Older"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">{bucketSessions.length}</span>
                </div>
              </div>

              <div className="space-y-1 px-1">
                {bucketSessions.map((session) => (
                  <SessionItem
                    key={session.session_id}
                    session={session}
                    isSelected={selectedSession?.session_id === session.session_id}
                    onSelect={() => onSessionSelect(session)}
                    onHover={() => onSessionHover?.(session)}
                    formatTimeAgo={formatTimeAgo}
                    showProject
                    projectLabel={session.project_name}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {isLoading && sessions.length > 0 && (
        <div className={cn("px-3 text-[11px] text-muted-foreground")}>Loading more sessions…</div>
      )}
    </div>
  );
};
