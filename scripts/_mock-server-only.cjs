/**
 * Require hook: makes 'server-only' a no-op when running outside Next.js.
 * Used by eval/benchmark scripts that call server-side AI code directly.
 *
 * Usage: npx tsx --require ./scripts/_mock-server-only.cjs <script.ts>
 */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, arguments);
};
