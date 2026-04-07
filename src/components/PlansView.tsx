import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock3, Link2, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Markdown } from "@/components/common/Markdown";
import { useAllSessions } from "@/hooks/useAllSessions";
import { findProjectForSession } from "@/utils/sessionNavigation";
import type { ClaudeSession } from "@/types";
import { cn } from "@/lib/utils";

export const PlansView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    projects,
    plans,
    userMetadata,
    loadPlans,
    selectPlan,
    selectProject,
    selectSession,
    setAnalyticsCurrentView,
  } = useAppStore();

  const claudeProjects = useMemo(
    () => projects.filter((project) => (project.provider ?? "claude") === "claude"),
    [projects]
  );
  const { sessions } = useAllSessions(claudeProjects);

  useEffect(() => {
    if (!plans.items.length && !plans.isLoadingPlans) {
      void loadPlans();
    }
  }, [loadPlans, plans.isLoadingPlans, plans.items.length]);

  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return plans.items;
    }

    return plans.items.filter((plan) => {
      return (
        plan.slug.toLowerCase().includes(query) ||
        plan.title.toLowerCase().includes(query)
      );
    });
  }, [plans.items, searchQuery]);

  const sessionCountByPlanSlug = useMemo(() => {
    const counts = new Map<string, number>();

    for (const session of sessions) {
      const linkedSlugs = new Set<string>();
      if (session.slug) {
        linkedSlugs.add(session.slug);
      }

      const manualPlanSlug = userMetadata.sessions[session.session_id]?.planSlug;
      if (manualPlanSlug) {
        linkedSlugs.add(manualPlanSlug);
      }

      for (const slug of linkedSlugs) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }

    return counts;
  }, [sessions, userMetadata.sessions]);

  const linkedSessions = useMemo(() => {
    if (!plans.selectedPlanSlug) {
      return [];
    }

    return sessions.filter((session) => {
      const manualPlanSlug = userMetadata.sessions[session.session_id]?.planSlug;
      return session.slug === plans.selectedPlanSlug || manualPlanSlug === plans.selectedPlanSlug;
    });
  }, [plans.selectedPlanSlug, sessions, userMetadata.sessions]);

  const subagentPlans = useMemo(() => {
    if (!plans.selectedPlanSlug) {
      return [];
    }

    const selected = plans.items.find((plan) => plan.slug === plans.selectedPlanSlug);
    const parentSlug = selected?.isSubagent ? selected.parentSlug : selected?.slug;
    if (!parentSlug) {
      return [];
    }

    return plans.items.filter((plan) => plan.parentSlug === parentSlug);
  }, [plans.items, plans.selectedPlanSlug]);

  const handleOpenSession = async (session: ClaudeSession) => {
    const project = findProjectForSession(projects, session);
    if (project) {
      await selectProject(project);
    }
    await selectSession(session);
    setAnalyticsCurrentView("messages");
  };

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row overflow-hidden rounded-xl border border-border/50 bg-card/20">
      <aside className="w-full shrink-0 border-b border-border/50 md:w-80 md:border-b-0 md:border-r">
        <div className="border-b border-border/50 p-3">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Search plans..."
          />
        </div>
        <div className="max-h-[35vh] overflow-y-auto md:max-h-none md:h-[calc(100%-61px)]">
          {plans.isLoadingPlans ? (
            <div className="p-4 text-sm text-muted-foreground">Loading plans…</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No plans found.</div>
          ) : (
            filteredPlans.map((plan) => {
              const relatedCount = sessionCountByPlanSlug.get(plan.slug) ?? 0;

              return (
                <button
                  key={plan.slug}
                  type="button"
                  onClick={() => {
                    void selectPlan(plan.slug);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border/40 px-4 py-3 text-left hover:bg-accent/8",
                    plans.selectedPlanSlug === plan.slug && "bg-accent/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-accent" />
                    <span className="truncate text-sm font-medium">{plan.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{plan.slug}</span>
                    <span>·</span>
                    <span>{new Date(plan.lastModified).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{relatedCount} sessions</span>
                    {plan.isSubagent && <span className="rounded-full bg-muted px-1.5 py-0.5">subagent</span>}
                    {typeof plan.daysUntilExpiry === "number" && plan.daysUntilExpiry <= 5 && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                        expires soon
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {plans.isLoadingPlanContent ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading plan…
          </div>
        ) : plans.selectedPlan ? (
          <>
            <div className="border-b border-border/50 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{plans.selectedPlan.title}</h3>
                {plans.selectedPlan.isSubagent && (
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    subagent plan
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(plans.selectedPlan.lastModified).toLocaleString()}</span>
                <span>{plans.selectedPlan.slug}</span>
                {typeof plans.selectedPlan.daysUntilExpiry === "number" && (
                  <span>{plans.selectedPlan.daysUntilExpiry} days until expiry</span>
                )}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-y-auto p-4">
                <Markdown>{plans.selectedPlan.content}</Markdown>
              </div>

              <aside className="border-t border-border/50 bg-muted/10 lg:border-l lg:border-t-0 overflow-y-auto">
                <div className="space-y-6 p-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Link2 className="h-4 w-4 text-accent" /> Linked sessions
                    </div>
                    {linkedSessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No linked sessions found.</p>
                    ) : (
                      <div className="space-y-2">
                        {linkedSessions.map((session) => (
                          <button
                            key={session.session_id}
                            type="button"
                            onClick={() => {
                              void handleOpenSession(session);
                            }}
                            className="w-full rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-left hover:bg-accent/8"
                          >
                            <div className="truncate text-sm font-medium">
                              {userMetadata.sessions[session.session_id]?.customName || session.summary || session.session_id}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {session.project_name} · {new Date(session.last_message_time).toLocaleString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold">Subagent plans</div>
                    {subagentPlans.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No subagent plans.</p>
                    ) : (
                      <div className="space-y-2">
                        {subagentPlans.map((plan) => (
                          <button
                            key={plan.slug}
                            type="button"
                            onClick={() => {
                              void selectPlan(plan.slug);
                            }}
                            className="w-full rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-left hover:bg-accent/8"
                          >
                            <div className="truncate text-sm font-medium">{plan.title}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{plan.slug}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a plan to preview it.
          </div>
        )}
      </section>
    </div>
  );
};
