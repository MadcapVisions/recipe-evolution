import { execSync } from "node:child_process";

function main() {
  const output = execSync("node --env-file=.env.local --import tsx scripts/eval-chef-catalog.ts", {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = /Ready to stop expanding:\s+yes/.test(output);
  const blockers = output.match(/Blockers:\s+([^\n]+)/)?.[1] ?? "unknown";
  const recommendation = output.match(/Recommendation:\s+([^\n]+)/)?.[1] ?? "unknown";

  console.log(`Ready to stop expanding: ${ready ? "yes" : "no"}`);
  console.log(`Blockers: ${blockers}`);
  console.log(`Recommendation: ${recommendation}`);

  if (!ready) {
    process.exitCode = 1;
  }
}

main();
