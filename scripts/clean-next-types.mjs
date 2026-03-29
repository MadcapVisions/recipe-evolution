import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, ".next/types"),
  path.join(ROOT, ".next/dev/types"),
];
const DUPLICATE_SUFFIX = /\s+\d+\.ts$/;

function removeDuplicateCopies(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += removeDuplicateCopies(fullPath);
      continue;
    }
    if (entry.isFile() && DUPLICATE_SUFFIX.test(entry.name)) {
      fs.rmSync(fullPath, { force: true });
      removed += 1;
    }
  }
  return removed;
}

const removed = TARGET_DIRS.reduce((sum, dir) => sum + removeDuplicateCopies(dir), 0);
if (removed > 0) {
  process.stdout.write(`removed ${removed} duplicate generated type file(s)\n`);
}
