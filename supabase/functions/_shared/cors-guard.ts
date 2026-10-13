// Restringe o CORS das Edge Functions às origens oficiais do site.
// Uso: `serveWithCors(handler)` no lugar de `Deno.serve(handler)`.
// Envolve o handler e reescreve Access-Control-Allow-Origin conforme a
// origem da requisição. Chamadas servidor-a-servidor (webhooks, cron) não
// enviam Origin e não são afetadas.
const ALLOWED_EXACT = new Set([
  "https://revisaofacil.com.br",
  "https://www.revisaofacil.com.br",
  "https://treasure-trove-tv.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);
const ALLOWED_SUFFIX = [".lovable.app", ".lovableproject.com", ".lovable.dev"];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && ALLOWED_SUFFIX.some((s) => u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

type Handler = (req: Request, info?: unknown) => Response | Promise<Response>;

function wrap(handler: Handler): Handler {
  return async (req, info) => {
    const origin = req.headers.get("origin");
    const res = await handler(req, info);
    if (!origin) return res;
    try {
      const headers = new Headers(res.headers);
      if (isAllowedOrigin(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.append("Vary", "Origin");
      } else {
        headers.set("Access-Control-Allow-Origin", "https://revisaofacil.com.br");
      }
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    } catch {
      return res;
    }
  };
}

// Use no lugar de Deno.serve (o namespace Deno é congelado e não pode ser alterado).
// deno-lint-ignore no-explicit-any
export function serveWithCors(...args: any[]) {
  // deno-lint-ignore no-explicit-any
  const serve = Deno.serve as any;
  if (typeof args[0] === "function") return serve(wrap(args[0]));
  if (typeof args[1] === "function") return serve(args[0], wrap(args[1]));
  if (args[0] && typeof args[0].handler === "function") return serve({ ...args[0], handler: wrap(args[0].handler) });
  return serve(...args);
}
