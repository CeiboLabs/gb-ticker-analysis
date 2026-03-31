// Minimal stub for @deno/shim-deno.
// yahoo-finance2 only uses Deno.stdout.isTerminal() — always false in
// non-interactive (serverless/edge) environments.
exports.Deno = { stdout: { isTerminal: () => false } };
