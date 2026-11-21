import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const asList = (page) => (Array.isArray(page) ? page : page?.items ?? []);

export function useProducts() {
  return useQuery({
    queryKey: ["pv", "products"],
    queryFn: async () => asList(await base44.entities.Product.list({ sort: "brand_name", limit: 200 })),
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: ["pv", "strategies"],
    queryFn: async () => asList(await base44.entities.SearchStrategy.list({ sort: "-created_date", limit: 500 })),
  });
}

export function useRuns() {
  return useQuery({
    queryKey: ["pv", "runs"],
    queryFn: async () => asList(await base44.entities.SearchRun.list({ sort: "-date_range_end", limit: 100 })),
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["pv", "cases"],
    queryFn: async () => asList(await base44.entities.Case.list({ sort: "due_date", limit: 500 })),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["pv", "settings"],
    queryFn: async () => asList(await base44.entities.AppSettings.list({ limit: 1 }))[0] || null,
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["pv", "audit"],
    queryFn: async () => asList(await base44.entities.AuditLog.list({ sort: "-timestamp", limit: 500 })),
  });
}

export function useQueueData() {
  return useQuery({
    queryKey: ["pv", "queue"],
    queryFn: async () => {
      const [articles, triages, decisions, runs, products] = await Promise.all([
        base44.entities.Article.list({ sort: "-created_date", limit: 500 }),
        base44.entities.Triage.list({ limit: 1000 }),
        base44.entities.ReviewDecision.list({ limit: 1000 }),
        base44.entities.SearchRun.list({ sort: "-date_range_end", limit: 100 }),
        base44.entities.Product.list({ sort: "brand_name", limit: 200 }),
      ]);
      return {
        articles: asList(articles),
        triages: asList(triages),
        decisions: asList(decisions),
        runs: asList(runs),
        products: asList(products),
      };
    },
  });
}

export function useRunWorkspace(runId) {
  return useQuery({
    queryKey: ["pv", "run", runId],
    enabled: !!runId,
    queryFn: async () => {
      const [run, articles, triages, decisions, runs, strategies] = await Promise.all([
        base44.entities.SearchRun.get(runId),
        base44.entities.Article.list({ sort: "-created_date", limit: 1000 }),
        base44.entities.Triage.list({ limit: 2000 }),
        base44.entities.ReviewDecision.list({ limit: 2000 }),
        base44.entities.SearchRun.list({ sort: "-date_range_end", limit: 100 }),
        base44.entities.SearchStrategy.list({ sort: "-created_date", limit: 500 }),
      ]);
      return {
        run,
        articles: asList(articles),
        triages: asList(triages),
        decisions: asList(decisions),
        runs: asList(runs),
        strategies: asList(strategies),
      };
    },
  });
}

export function useCollection(entityName, { sort, limit = 500, enabled = true } = {}) {
  return useQuery({
    queryKey: ["pv", entityName, sort || "", limit],
    enabled,
    queryFn: async () => asList(await base44.entities[entityName].list({ ...(sort ? { sort } : {}), limit })),
  });
}

export const useSignals = () => useCollection("Signal", { sort: "-opened_date", limit: 500 });
export const useTasks = () => useCollection("Task", { sort: "-created_date", limit: 500 });
export const useForeignActions = () => useCollection("ForeignAction", { sort: "-awareness_date", limit: 500 });
export const useAnnualReports = () => useCollection("AnnualReport", { sort: "-period_end", limit: 200 });
export const useChangeLogs = () => useCollection("ChangeLog", { sort: "-created_date", limit: 200 });
export const useValidationRuns = () => useCollection("ValidationRun", { sort: "-run_date", limit: 50 });
export const useScanLogs = () => useCollection("ScanLog", { sort: "-date", limit: 500 });
export const useFollowUps = () => useCollection("FollowUp", { sort: "-date_requested", limit: 1000 });

export function useCaseFamily(record) {
  return useQuery({
    queryKey: ["pv", "case-family", record?.initial_case || record?.id],
    enabled: !!record?.id,
    queryFn: async () => {
      const initial = record.initial_case || record.id;
      const all = asList(await base44.entities.Case.list({ limit: 500 }));
      return all
        .filter((c) => c.id === initial || c.initial_case === initial || c.id === record.id)
        .sort((a, b) => (a.version || 1) - (b.version || 1));
    },
  });
}

export function useCaseDetail(caseId) {
  return useQuery({
    queryKey: ["pv", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const record = await base44.entities.Case.get(caseId);
      const followUps = asList(await base44.entities.FollowUp.filter({ case: record.id }, { sort: "-date_requested", limit: 200 }));
      const [article, product, triage, decisions] = await Promise.all([
        record.article ? base44.entities.Article.get(record.article).catch(() => null) : null,
        record.product ? base44.entities.Product.get(record.product).catch(() => null) : null,
        record.article
          ? base44.entities.Triage.filter({ article: record.article }, { limit: 1 }).then((p) => asList(p)[0] || null)
          : null,
        record.article
          ? base44.entities.ReviewDecision.filter({ article: record.article }, { limit: 5 }).then(asList)
          : [],
      ]);
      return { record, article, product, triage, decisions, followUps };
    },
  });
}