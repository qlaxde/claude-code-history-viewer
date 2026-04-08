import type { StateCreator } from "zustand";
import type { FullAppStore } from "./types";
import type {
  AutoArchiveResult,
  HookInstallResult,
  RunningSessionInfo,
} from "@/types";
import { workflowApi } from "@/services/workflowApi";
import { archiveApi } from "@/services/archiveApi";

export interface RuntimeSliceState {
  runtime: {
    runningSessions: RunningSessionInfo[];
    isLoadingRunningSessions: boolean;
    runningSessionsError: string | null;
    isAutoArchiving: boolean;
    lastAutoArchiveResult: AutoArchiveResult | null;
    isInstallingHooks: boolean;
    hookInstallResult: HookInstallResult | null;
  };
}

export interface RuntimeSliceActions {
  loadRunningSessions: () => Promise<void>;
  killSessionProcess: (pid: number) => Promise<void>;
  autoArchiveExpiring: (thresholdDays: number) => Promise<AutoArchiveResult>;
  installHooks: () => Promise<HookInstallResult>;
  clearRuntimeError: () => void;
}

export type RuntimeSlice = RuntimeSliceState & RuntimeSliceActions;

const initialRuntimeState: RuntimeSliceState["runtime"] = {
  runningSessions: [],
  isLoadingRunningSessions: false,
  runningSessionsError: null,
  isAutoArchiving: false,
  lastAutoArchiveResult: null,
  isInstallingHooks: false,
  hookInstallResult: null,
};

export const createRuntimeSlice: StateCreator<
  FullAppStore,
  [],
  [],
  RuntimeSlice
> = (set) => ({
  runtime: { ...initialRuntimeState },

  loadRunningSessions: async () => {
    set((state) => ({
      runtime: {
        ...state.runtime,
        isLoadingRunningSessions: true,
        runningSessionsError: null,
      },
    }));

    try {
      const runningSessions = await workflowApi.getRunningSessions();
      set((state) => ({
        runtime: {
          ...state.runtime,
          runningSessions,
          isLoadingRunningSessions: false,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        runtime: {
          ...state.runtime,
          isLoadingRunningSessions: false,
          runningSessionsError: message,
        },
      }));
    }
  },

  killSessionProcess: async (pid) => {
    await workflowApi.killSession(pid);
    const runningSessions = await workflowApi.getRunningSessions();
    set((state) => ({
      runtime: {
        ...state.runtime,
        runningSessions,
      },
    }));
  },

  autoArchiveExpiring: async (thresholdDays) => {
    set((state) => ({
      runtime: {
        ...state.runtime,
        isAutoArchiving: true,
        runningSessionsError: null,
      },
    }));

    try {
      const result = await archiveApi.autoArchiveExpiring(thresholdDays);
      set((state) => ({
        runtime: {
          ...state.runtime,
          isAutoArchiving: false,
          lastAutoArchiveResult: result,
        },
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        runtime: {
          ...state.runtime,
          isAutoArchiving: false,
          runningSessionsError: message,
        },
      }));
      throw error;
    }
  },

  installHooks: async () => {
    set((state) => ({
      runtime: {
        ...state.runtime,
        isInstallingHooks: true,
        runningSessionsError: null,
      },
    }));

    try {
      const result = await workflowApi.installHooks();
      set((state) => ({
        runtime: {
          ...state.runtime,
          isInstallingHooks: false,
          hookInstallResult: result,
        },
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        runtime: {
          ...state.runtime,
          isInstallingHooks: false,
          runningSessionsError: message,
        },
      }));
      throw error;
    }
  },

  clearRuntimeError: () => {
    set((state) => ({
      runtime: {
        ...state.runtime,
        runningSessionsError: null,
      },
    }));
  },
});
