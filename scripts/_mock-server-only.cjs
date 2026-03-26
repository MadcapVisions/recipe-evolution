/**
 * Require hook: makes 'server-only' a no-op when running outside Next.js.
 * Used by eval/benchmark scripts that call server-side AI code directly.
 *
 * Usage: npx tsx --require ./scripts/_mock-server-only.cjs <script.ts>
 */
const Module = require("module");
const fs = require("fs");
const path = require("path");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (typeof request === "string" && request.startsWith("@/")) {
    const relativePath = request.slice(2);
    const compiledPath = path.join(process.cwd(), ".tmp-unit", relativePath);
    const sourcePath = path.join(process.cwd(), relativePath);
    const resolved = fs.existsSync(`${compiledPath}.js`) || fs.existsSync(compiledPath) ? compiledPath : sourcePath;
    return originalLoad.call(this, resolved, parent, isMain);
  }
  return originalLoad.apply(this, arguments);
};
