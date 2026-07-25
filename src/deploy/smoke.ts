// Post-deploy verification: confirm the just-published edition is actually live.
// The newest edition's page (served at /<date>/) contains its own "like" links
// pointing at /<date>/<n>/, so the dated path is a reliable liveness marker.
export function htmlHasDate(html: string, date: string): boolean {
  return html.includes(`/${date}/`);
}

export async function checkLiveSite(opts: {
  baseUrl: string;
  date: string;
  fetchText?: (url: string) => Promise<string>;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<void> {
  const fetchText =
    opts.fetchText ??
    (async (url: string) => {
      const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
      return res.text();
    });
  const attempts = opts.attempts ?? 10;
  const delayMs = opts.delayMs ?? 10_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const target = `${opts.baseUrl.replace(/\/$/, "")}/${opts.date}/`;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const html = await fetchText(target);
      if (htmlHasDate(html, opts.date)) return;
      lastErr = new Error(`live page ${target} did not reference today's date ${opts.date}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`smoke check failed after ${attempts} attempts: ${reason}`);
}
