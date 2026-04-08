import type { ClaudeSession } from "./core/session";

export interface Plan {
  slug: string;
  title: string;
  lastModified: string;
  filePath: string;
  parentSlug?: string;
  isSubagent?: boolean;
  daysUntilExpiry?: number;
}

export interface PlanContent extends Plan {
  content: string;
}

export interface AutoArchiveResult {
  archivedCount: number;
  archiveIds: string[];
  archivedSessionIds: string[];
  archivedPlanSlugs: string[];
}

export interface HookInstallResult {
  installed: boolean;
  hookScriptPath: string;
  settingsPath: string;
}

export interface ResolvedPlanLink {
  slug: string;
  title: string;
}

export interface LinkedPlanSession extends ClaudeSession {
  resolvedPlanSlug?: string;
}
