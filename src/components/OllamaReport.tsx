import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2, PlugZap, RefreshCw } from "lucide-react";
import type { AnalyticsResult } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildOllamaPayload,
  generateOllamaReport,
  testOllamaConnection
} from "@/lib/ollama";

interface OllamaReportProps {
  analytics: AnalyticsResult;
}

export function OllamaReport({ analytics }: OllamaReportProps) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [model, setModel] = useState("llama3.1");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const payload = useMemo(() => buildOllamaPayload(analytics), [analytics]);

  async function handleTestConnection() {
    setIsTesting(true);
    setError(null);
    const result = await testOllamaConnection(baseUrl);
    setConnectionOk(result.ok);
    setConnectionMessage(
      result.ok
        ? result.models.length > 0
          ? `Connexion OK. Modeles detectes: ${result.models.join(", ")}`
          : "Connexion OK. Aucun modele installe: BitStat telechargera le modele au moment de generer."
        : result.error ?? "Connexion impossible."
    );
    if (result.ok && result.models.length > 0) {
      setModel((currentModel) => pickModel(currentModel, result.models));
    }
    setIsTesting(false);
  }

  async function handleGenerateReport() {
    setIsGenerating(true);
    setError(null);
    setGenerationStatus("Preparation Ollama...");
    setReport("");

    try {
      const result = await generateOllamaReport({
        baseUrl,
        model,
        payload,
        onStatus: setGenerationStatus
      });
      setModel(result.model);
      setReport(result.report);
      setConnectionOk(true);
      setConnectionMessage(`Rapport genere avec le modele ${result.model}.`);
      setGenerationStatus(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Erreur inconnue pendant la generation du rapport."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
              Rapport IA local
            </CardTitle>
            <CardDescription>
              BitStat detecte le modele disponible et Ollama recoit seulement le resume statistique.
            </CardDescription>
          </div>
          <div className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {analytics.stats.totalTrades} trades dans le payload
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="ollama-url">URL Ollama</Label>
            <Input
              id="ollama-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ollama-model">Modele</Label>
            <Input
              id="ollama-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="llama3.1"
            />
          </div>
          <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="h-4 w-4" aria-hidden="true" />
            )}
            Tester
          </Button>
          <Button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating || analytics.stats.totalTrades === 0}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : report ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            Generer
          </Button>
        </div>

        {connectionMessage ? (
          <p className={connectionOk ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
            {connectionMessage}
          </p>
        ) : null}

        {generationStatus ? <p className="text-sm text-primary">{generationStatus}</p> : null}

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {report ? (
          <article className="max-h-[620px] overflow-auto rounded-md border bg-zinc-50 p-4 text-sm leading-6 whitespace-pre-wrap">
            {report}
          </article>
        ) : (
          <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
            Le rapport apparait ici apres generation locale.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function pickModel(currentModel: string, models: string[]) {
  const requested = currentModel.trim().toLowerCase();
  const exact = models.find((model) => model.toLowerCase() === requested);
  const latest = models.find((model) => model.toLowerCase() === `${requested}:latest`);
  const sameFamily = models.find((model) => model.toLowerCase().startsWith(`${requested}:`));

  return exact ?? latest ?? sameFamily ?? models[0] ?? currentModel;
}
