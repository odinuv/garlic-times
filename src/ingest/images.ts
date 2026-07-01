import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

async function realFetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "garlic-times-ingest/1.0" } });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}) for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function downloadImage(opts: {
  imageUrl: string;
  destDir: string;
  basename: string;
  fetchBytes?: (url: string) => Promise<Uint8Array>;
}): Promise<string> {
  const fetchBytes = opts.fetchBytes ?? realFetchBytes;
  const bytes = await fetchBytes(opts.imageUrl);
  if (!existsSync(opts.destDir)) mkdirSync(opts.destDir, { recursive: true });
  const path = resolve(join(opts.destDir, `${opts.basename}.jpg`));
  writeFileSync(path, bytes);
  return path;
}
