// The cumulative, restorable state that lives in Azure Blob Storage as a single
// gzip tarball — minimizing round-trips to one download + one upload per run.
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import type { BlobStore } from "@/archive/blob";

export const STATE_BLOB = "state-latest.tar.gz";

const SOURCES = ["cnn", "fox"] as const;

// Paths (relative to repo root) that must survive between runs.
const STATE_PATHS = ["content/src", "content/img", "content/market.json", "archive/sources"];

async function runTar(args: string[]): Promise<void> {
  const proc = Bun.spawn(["tar", ...args], { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`tar ${args.join(" ")} failed (exit ${code})`);
}

export async function restoreState(
  store: BlobStore,
  opts: { root: string; tmpTar: string },
): Promise<{ restored: boolean }> {
  if (!(await store.exists(STATE_BLOB))) return { restored: false };
  await store.download(STATE_BLOB, opts.tmpTar);
  await runTar(["-xzf", opts.tmpTar, "-C", opts.root]);
  return { restored: true };
}

// Copy today's transient source pool into the per-date archive kept for audit /
// future re-authoring. The live content/sources/ dir is cleared each ingest run.
export function archiveTodaysPool(opts: { root: string; date: string }): void {
  const { root, date } = opts;
  for (const source of SOURCES) {
    const from = join(root, "content", "sources", source);
    if (!existsSync(from)) continue;
    const to = join(root, "archive", "sources", date, source);
    if (!existsSync(to)) mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
}

export async function saveState(
  store: BlobStore,
  opts: { root: string; date: string; tmpTar: string },
): Promise<void> {
  archiveTodaysPool(opts);
  const present = STATE_PATHS.filter((p) => existsSync(join(opts.root, p)));
  if (present.length === 0) throw new Error("saveState: no state paths present to archive");
  await runTar(["-czf", opts.tmpTar, "-C", opts.root, ...present]);
  await store.upload(STATE_BLOB, opts.tmpTar);
}
