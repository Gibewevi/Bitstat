import type { AnalyticsResult } from "@/types/trade";

export const OLLAMA_SYSTEM_PROMPT = `Tu es un analyste de performance spécialisé dans le trading de futures et les comptes Prop Firm.

Tu analyses uniquement les données historiques fournies.

Tu ne donnes jamais de signaux d’achat ou de vente.

Ton rôle est d’identifier les comportements statistiques, les horaires à risque, l’impact des commissions, les forces et les faiblesses du trader.

Tu dois être précis, direct, neutre et orienté amélioration.

Base toujours tes conclusions sur les chiffres fournis.

Tu ne dois jamais inventer de données absentes du JSON fourni.`;

export interface OllamaReportPayload {
  generatedAt: string;
  scope: "loaded_csv_summary";
  globalStats: AnalyticsResult["stats"];
  pnlByDay: AnalyticsResult["daily"];
  pnlByHour: AnalyticsResult["hourly"];
  averageDurations: {
    winningTradesSeconds: number;
    losingTradesSeconds: number;
  };
  bestHours: AnalyticsResult["patterns"]["bestHours"];
  worstHours: AnalyticsResult["patterns"]["worstHours"];
  commissionImpact: {
    totalCommissionFees: number;
    commissionPerTrade: number;
    commissionToGrossProfitRate: number | null;
  };
  detectedPatterns: {
    tradesPerDay: AnalyticsResult["patterns"]["tradesPerDay"];
    overtradingDays: AnalyticsResult["patterns"]["overtradingDays"];
    isolatedLargeLosses: AnalyticsResult["patterns"]["isolatedLargeLosses"];
    messages: string[];
  };
}

export interface OllamaConnectionResult {
  ok: boolean;
  models: string[];
  error?: string;
}

export interface OllamaGenerateResult {
  report: string;
  model: string;
}

export function buildOllamaPayload(analytics: AnalyticsResult): OllamaReportPayload {
  return {
    generatedAt: new Date().toISOString(),
    scope: "loaded_csv_summary",
    globalStats: analytics.stats,
    pnlByDay: analytics.daily,
    pnlByHour: analytics.hourly,
    averageDurations: {
      winningTradesSeconds: analytics.patterns.averageWinningDurationSeconds,
      losingTradesSeconds: analytics.patterns.averageLosingDurationSeconds
    },
    bestHours: analytics.patterns.bestHours,
    worstHours: analytics.patterns.worstHours,
    commissionImpact: {
      totalCommissionFees: analytics.stats.totalCommissionFees,
      commissionPerTrade: analytics.stats.commissionPerTrade,
      commissionToGrossProfitRate: analytics.stats.commissionToGrossProfitRate
    },
    detectedPatterns: {
      tradesPerDay: analytics.patterns.tradesPerDay,
      overtradingDays: analytics.patterns.overtradingDays,
      isolatedLargeLosses: analytics.patterns.isolatedLargeLosses,
      messages: analytics.patterns.detected
    }
  };
}

export async function testOllamaConnection(baseUrl: string): Promise<OllamaConnectionResult> {
  try {
    return {
      ok: true,
      models: await listOllamaModels(baseUrl)
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: formatOllamaFetchError(error)
    };
  }
}

export async function generateOllamaReport({
  baseUrl,
  model,
  payload,
  onStatus
}: {
  baseUrl: string;
  model: string;
  payload: OllamaReportPayload;
  onStatus?: (status: string) => void;
}): Promise<OllamaGenerateResult> {
  let resolvedModel: string;

  try {
    resolvedModel = await ensureOllamaModel(baseUrl, model, onStatus);
  } catch (error) {
    throw new Error(formatOllamaFetchError(error));
  }
  const prompt = `Genere un rapport en francais a partir du JSON ci-dessous.

Le rapport doit contenir ces sections:
- Resume global
- Points forts
- Points faibles
- Meilleurs horaires
- Pires horaires
- Impact des commissions
- Analyse de la duree des trades
- Erreurs probables
- Recommandations concretes
- Regles simples a tester
- Synthese en 5 points

JSON:
${JSON.stringify(payload, null, 2)}`;

  let response: Response;

  try {
    onStatus?.(`Generation du rapport avec ${resolvedModel}...`);
    response = await fetchWithTimeout(
      `${resolveOllamaBaseUrl(baseUrl)}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: resolvedModel,
          system: OLLAMA_SYSTEM_PROMPT,
          prompt,
          stream: false
        })
      },
      180000
    );
  } catch (error) {
    throw new Error(formatOllamaFetchError(error));
  }

  if (!response.ok) {
    const ollamaError = await readOllamaError(response);
    throw new Error(
      ollamaError ||
        `Ollama a repondu avec le statut ${response.status} pendant la generation.`
    );
  }

  const data = (await response.json()) as { response?: string; error?: string };

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    report: data.response ?? "",
    model: resolvedModel
  };
}

async function listOllamaModels(baseUrl: string) {
  await ensureLocalOllamaServer(baseUrl);
  const response = await fetchWithTimeout(`${resolveOllamaBaseUrl(baseUrl)}/api/tags`, {}, 5000);

  if (!response.ok) {
    const ollamaError = await readOllamaError(response);
    if (response.status === 502) {
      throw new Error("Ollama ne repond pas sur localhost:11434.");
    }
    throw new Error(
      ollamaError ||
        `Ollama a repondu avec le statut ${response.status}. Verifie que Ollama est demarre avec "ollama serve".`
    );
  }

  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  return data.models?.map((item) => item.name).filter(Boolean) as string[];
}

async function ensureOllamaModel(
  baseUrl: string,
  requestedModel: string,
  onStatus?: (status: string) => void
) {
  const modelToUse = requestedModel.trim() || "llama3.1";

  onStatus?.("Verification des modeles Ollama installes...");
  const installedModels = await listOllamaModels(baseUrl);
  const installedMatch = selectBestModel(modelToUse, installedModels);

  if (installedMatch) {
    if (installedMatch !== modelToUse) {
      onStatus?.(`Modele "${modelToUse}" absent. Utilisation automatique de "${installedMatch}".`);
    }
    return installedMatch;
  }

  onStatus?.(`Aucun modele installe. Telechargement local de "${modelToUse}" via Ollama...`);
  await pullOllamaModel(baseUrl, modelToUse);

  const modelsAfterPull = await listOllamaModels(baseUrl);
  return selectBestModel(modelToUse, modelsAfterPull) ?? modelToUse;
}

function selectBestModel(requestedModel: string, installedModels: string[]) {
  if (installedModels.length === 0) {
    return null;
  }

  const requested = requestedModel.toLowerCase();
  const exact = installedModels.find((model) => model.toLowerCase() === requested);

  if (exact) {
    return exact;
  }

  const latest = installedModels.find((model) => model.toLowerCase() === `${requested}:latest`);

  if (latest) {
    return latest;
  }

  const sameFamily = installedModels.find((model) =>
    model.toLowerCase().startsWith(`${requested}:`)
  );

  if (sameFamily) {
    return sameFamily;
  }

  const preferredFamilies = ["llama3.1", "llama3", "qwen", "mistral", "gemma", "phi"];

  return (
    preferredFamilies
      .map((family) => installedModels.find((model) => model.toLowerCase().startsWith(family)))
      .find(Boolean) ?? installedModels[0]
  );
}

async function pullOllamaModel(baseUrl: string, model: string) {
  await ensureLocalOllamaServer(baseUrl);
  const response = await fetchWithTimeout(
    `${resolveOllamaBaseUrl(baseUrl)}/api/pull`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: model,
        stream: false
      })
    },
    30 * 60 * 1000
  );

  if (!response.ok) {
    const ollamaError = await readOllamaError(response);
    throw new Error(
      ollamaError ||
        `Ollama n'a pas pu telecharger le modele "${model}" (statut ${response.status}).`
    );
  }

  const data = (await response.json()) as { error?: string };

  if (data.error) {
    throw new Error(data.error);
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function resolveOllamaBaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl.trim() || "http://localhost:11434");

  if (import.meta.env.DEV && isLocalOllamaUrl(normalized)) {
    return "/ollama";
  }

  return normalized;
}

async function ensureLocalOllamaServer(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl.trim() || "http://localhost:11434");

  if (!import.meta.env.DEV || !isLocalOllamaUrl(normalized)) {
    return;
  }

  const response = await fetchWithTimeout(
    "/bitstat-api/ollama/ensure-running",
    { method: "POST" },
    35000
  );

  if (!response.ok) {
    const error = await readOllamaError(response);
    throw new Error(
      error || "BitStat n'a pas pu demarrer Ollama automatiquement."
    );
  }
}

function isLocalOllamaUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "11434"
    );
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatOllamaFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return 'Ollama ne repond pas. Lance "ollama serve", puis reteste la connexion.';
  }

  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return 'Connexion Ollama impossible depuis le navigateur. BitStat passe par le proxy Vite en local; relance "npm run dev" et verifie que "ollama serve" tourne.';
  }

  return error instanceof Error ? error.message : "Connexion Ollama impossible.";
}

async function readOllamaError(response: Response) {
  try {
    const data = (await response.clone().json()) as { error?: string };
    return data.error;
  } catch {
    return "";
  }
}
