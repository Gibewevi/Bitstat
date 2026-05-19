import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { CsvUploader } from "@/components/CsvUploader";
import { Dashboard } from "@/components/Dashboard";
import { parseTradingCsv } from "@/lib/parseCsv";
import type { CsvParseResult } from "@/types/trade";

function App() {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [sourceName, setSourceName] = useState("");

  function loadCsvText(text: string, fileName: string) {
    setParseResult(parseTradingCsv(text));
    setSourceName(fileName);
  }

  const warnings = useMemo(
    () => parseResult?.warnings.filter((warning) => !warning.includes("date de trade invalide")) ?? [],
    [parseResult]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">BitStat</h1>
            <p className="text-sm text-muted-foreground">
              Analyse locale simple de CSV Prop Firm.
            </p>
          </div>
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          React · TypeScript · Vite · Recharts · PapaParse · Ollama local
        </div>
      </header>

      <CsvUploader onCsvText={loadCsvText} />

      {warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Avertissements de parsing</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {warnings.slice(0, 6).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {parseResult ? (
        <Dashboard
          trades={parseResult.trades}
          summaryRows={parseResult.summaryRows}
          sourceName={sourceName}
        />
      ) : (
        <section className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-medium">Charge un CSV pour afficher les statistiques.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Les donnees restent locales et proviennent uniquement du fichier importe.
          </p>
        </section>
      )}
    </main>
  );
}

export default App;
