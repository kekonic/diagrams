import { EXAMPLES } from "./examples.ts";
import { studioHostUrl } from "./host.ts";

export type SaveExampleResult =
  | { ok: true; id: string; path: string }
  | { ok: false; error: string };

/** Write the current editor source back to examples/<id>.kdiagram (dev server only). */
export async function saveExampleToRepo(id: string, source: string): Promise<SaveExampleResult> {
  if (!import.meta.env.DEV) {
    return { ok: false, error: "Saving to the repo is only available in the Vite dev server." };
  }

  try {
    const res = await fetch(studioHostUrl("__kdiagram/save-example"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, source }),
    });
    const data = (await res.json()) as SaveExampleResult;
    if (data.ok) {
      const entry = EXAMPLES.find((ex) => ex.id === id);
      if (entry) entry.source = source.endsWith("\n") ? source : `${source}\n`;
    }
    return data;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error while saving",
    };
  }
}

export function canSaveExampleToRepo(): boolean {
  return import.meta.env.DEV;
}
