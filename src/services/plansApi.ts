import { api } from "./api";
import type { Plan, PlanContent } from "@/types";

export const plansApi = {
  scanPlans: () => api<Plan[]>("scan_plans"),
  loadPlan: (slug: string) => api<PlanContent>("load_plan", { slug }),
};
