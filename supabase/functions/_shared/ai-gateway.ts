// Lovable AI Gateway provider helper for Edge Functions (Deno).
// Chat/completions path via @ai-sdk/openai-compatible — for non-OpenAI models
// (e.g. google/gemini-*). OpenAI models should use the Responses API instead.
//
// Reusable by any edge function: import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

// Captures/resends the Lovable AI Gateway run id across follow-up calls in the
// same server request, so a multi-step agent run shares one traceable run id.
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const next = value?.trim() || undefined;
    if (!runId && next) runId = next;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    // `fetch` here is the global; the object key introduces no binding.
    fetch: async (input: any, init?: any) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response: Response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch as typeof fetch,
  });
  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}

// Forward Lovable AI Gateway response headers (X-Lovable-AIG-*) to the browser.
export function getLovableAiGatewayResponseHeaders(providerHeaders?: HeadersInit, init?: HeadersInit) {
  const headers = new Headers(init);
  const exposed = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
  new Headers(providerHeaders).forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      headers.set(name, value);
      exposed.add(name);
    }
  });
  headers.forEach((_, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) exposed.add(name);
  });
  if (exposed.size > 0) headers.set("Access-Control-Expose-Headers", Array.from(exposed).join(", "));
  return headers;
}
