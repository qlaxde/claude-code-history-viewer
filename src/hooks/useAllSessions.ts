import { useEffect, useReducer, useRef, useState } from "react";
import type { ClaudeProject, ClaudeSession } from "@/types";
import { api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

interface UseAllSessionsResult {
  sessions: ClaudeSession[];
  isLoading: boolean;
  error: string | null;
}

export function useAllSessions(projects: ClaudeProject[]): UseAllSessionsResult {
  const excludeSidechain = useAppStore((state) => state.excludeSidechain);
  const cacheRef = useRef<Record<string, ClaudeSession[]>>({});
  const [, forceRerender] = useReducer((count: number) => count + 1, 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cacheRef.current = {};
    forceRerender();
  }, [excludeSidechain]);

  useEffect(() => {
    let cancelled = false;
    const missingProjects = projects.filter((project) => cacheRef.current[project.path] == null);

    if (missingProjects.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    void Promise.all(
      missingProjects.map(async (project) => {
        const provider = project.provider ?? "claude";
        const loaded = provider !== "claude"
          ? await api<ClaudeSession[]>("load_provider_sessions", {
              provider,
              projectPath: project.path,
              excludeSidechain,
            })
          : await api<ClaudeSession[]>("load_project_sessions", {
              projectPath: project.path,
              excludeSidechain,
            });

        cacheRef.current[project.path] = loaded.map((session) => ({
          ...session,
          provider: session.provider ?? project.provider,
        }));
      })
    )
      .then(() => {
        if (cancelled) {
          return;
        }
        forceRerender();
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [excludeSidechain, projects]);

  const projectPathSet = new Set(projects.map((project) => project.path));
  const sessions = Object.entries(cacheRef.current)
    .filter(([projectPath]) => projectPathSet.has(projectPath))
    .flatMap(([, value]) => value)
    .sort((a, b) => b.last_message_time.localeCompare(a.last_message_time));

  return {
    sessions,
    isLoading,
    error,
  };
}
