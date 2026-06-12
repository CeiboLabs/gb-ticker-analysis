import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // api.openai.com occasionally fails to resolve / connect through VPN or
      // corporate DNS resolvers (intermittent ENOTFOUND / ECONNREFUSED). Those
      // blips otherwise bubble up as a hard "Análisis no disponible" even
      // though the next attempt succeeds a second later. Let the SDK absorb the
      // common case here; route.ts wraps the streaming call with a longer
      // backoff for sustained outages. Connection failures fail fast (DNS
      // resolution < 1s), so extra retries don't eat the generation budget.
      maxRetries: 4,
      // Hard per-request timeout below the 60s worker ceiling. Without it a
      // hung connection holds the isolate (and a paid generation) until the
      // runtime force-kills it.
      timeout: 55_000,
    });
  }
  return _client;
}
