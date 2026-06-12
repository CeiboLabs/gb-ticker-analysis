import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // The SDK defaults to maxRetries: 2 — on a transient 429/5xx it silently
      // re-sends the request, and each retry that reaches the model bills input
      // tokens again. Cap at 1 retry so a flaky upstream can't triple the cost
      // of a single analysis. The edge runtime kills the worker at maxDuration
      // (60s) anyway, so unbounded retries can't run regardless.
      maxRetries: 1,
      // Hard per-request timeout below the 60s worker ceiling. Without it a
      // hung connection holds the isolate (and a paid generation) until the
      // runtime force-kills it.
      timeout: 55_000,
    });
  }
  return _client;
}
