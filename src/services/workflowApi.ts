import { api } from "./api";
import type {
  HookInstallResult,
  RunningSessionInfo,
} from "@/types";

export const workflowApi = {
  getRunningSessions: () => api<RunningSessionInfo[]>("get_running_sessions"),
  killSession: (pid: number) => api<void>("kill_session", { pid }),
  installHooks: () => api<HookInstallResult>("install_hooks"),
};
