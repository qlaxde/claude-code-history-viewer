import type { StateCreator } from "zustand";
import type { FullAppStore } from "./types";
import type { Plan, PlanContent } from "@/types";
import { plansApi } from "@/services/plansApi";

export interface PlansSliceState {
  plans: {
    items: Plan[];
    selectedPlanSlug: string | null;
    selectedPlan: PlanContent | null;
    isLoadingPlans: boolean;
    isLoadingPlanContent: boolean;
    error: string | null;
  };
}

export interface PlansSliceActions {
  loadPlans: () => Promise<void>;
  selectPlan: (slug: string | null) => Promise<void>;
  clearPlansError: () => void;
}

export type PlansSlice = PlansSliceState & PlansSliceActions;

const initialPlansState: PlansSliceState["plans"] = {
  items: [],
  selectedPlanSlug: null,
  selectedPlan: null,
  isLoadingPlans: false,
  isLoadingPlanContent: false,
  error: null,
};

export const createPlansSlice: StateCreator<
  FullAppStore,
  [],
  [],
  PlansSlice
> = (set, get) => ({
  plans: { ...initialPlansState },

  loadPlans: async () => {
    set((state) => ({
      plans: {
        ...state.plans,
        isLoadingPlans: true,
        error: null,
      },
    }));

    try {
      const items = await plansApi.scanPlans();
      set((state) => ({
        plans: {
          ...state.plans,
          items,
          isLoadingPlans: false,
          selectedPlanSlug:
            state.plans.selectedPlanSlug && items.some((plan) => plan.slug === state.plans.selectedPlanSlug)
              ? state.plans.selectedPlanSlug
              : items[0]?.slug ?? null,
        },
      }));

      const selected = get().plans.selectedPlanSlug;
      if (selected) {
        await get().selectPlan(selected);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        plans: {
          ...state.plans,
          isLoadingPlans: false,
          error: message,
        },
      }));
    }
  },

  selectPlan: async (slug) => {
    if (!slug) {
      set((state) => ({
        plans: {
          ...state.plans,
          selectedPlanSlug: null,
          selectedPlan: null,
          isLoadingPlanContent: false,
        },
      }));
      return;
    }

    set((state) => ({
      plans: {
        ...state.plans,
        selectedPlanSlug: slug,
        isLoadingPlanContent: true,
        error: null,
      },
    }));

    try {
      const selectedPlan = await plansApi.loadPlan(slug);
      set((state) => ({
        plans: {
          ...state.plans,
          selectedPlanSlug: slug,
          selectedPlan,
          isLoadingPlanContent: false,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        plans: {
          ...state.plans,
          selectedPlanSlug: slug,
          selectedPlan: null,
          isLoadingPlanContent: false,
          error: message,
        },
      }));
    }
  },

  clearPlansError: () => {
    set((state) => ({
      plans: {
        ...state.plans,
        error: null,
      },
    }));
  },
});
