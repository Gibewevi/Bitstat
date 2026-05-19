import path from "node:path";
import { spawn } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

export default defineConfig({
  plugins: [react(), localOllamaPlugin()],
  server: {
    proxy: {
      "/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (urlPath) => urlPath.replace(/^\/ollama/, "")
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});

function localOllamaPlugin(): Plugin {
  let startPromise: Promise<void> | null = null;

  return {
    name: "bitstat-local-ollama",
    configureServer(server) {
      server.middlewares.use("/bitstat-api/ollama/ensure-running", async (_request, response) => {
        try {
          if (await canReachOllama()) {
            sendJson(response, 200, { ok: true, started: false });
            return;
          }

          startPromise ??= startOllamaServe();
          await startPromise;
          await waitForOllama();

          sendJson(response, 200, { ok: true, started: true });
        } catch (error) {
          startPromise = null;
          sendJson(response, 503, {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Ollama est introuvable. Installe Ollama ou demarre-le manuellement."
          });
        }
      });
    }
  };
}

async function canReachOllama(timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForOllama() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30000) {
    if (await canReachOllama()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Ollama a ete lance, mais ne repond pas encore sur le port 11434.");
}

function startOllamaServe() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });

    child.once("error", () => {
      reject(new Error("Commande ollama introuvable. Installe Ollama ou ajoute-le au PATH."));
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function sendJson(
  response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
  statusCode: number,
  body: unknown
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
