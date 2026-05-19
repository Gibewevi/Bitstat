import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CsvUploaderProps {
  onCsvText: (text: string, fileName: string) => void;
}

export function CsvUploader({ onCsvText }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File) {
    setError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Le fichier doit etre un CSV.");
      return;
    }

    const text = await file.text();
    onCsvText(text, file.name);
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-dashed bg-white p-5 shadow-sm transition-colors",
        isDragging ? "border-primary bg-teal-50/40" : "border-zinc-300"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) {
          void readFile(file);
        }
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Importer un CSV</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Glisse un fichier de trades ou selectionne un CSV local.
            </p>
            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void readFile(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Choisir un CSV
          </Button>
        </div>
      </div>
    </section>
  );
}
