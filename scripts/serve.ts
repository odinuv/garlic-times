// Minimal static file server for previewing the generated `dist/` site.
// Serves files relative to the dist root so absolute asset paths
// (/styles.css, /img/..., /static/...) resolve correctly.
// Usage: bun run scripts/serve.ts  (or: bun run preview)
import { join, normalize } from "node:path";

const ROOT = "dist";
const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    // Map "/" and "/foo/" to their index.html; strip leading slash.
    const rel = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    // normalize() collapses ".." so requests can't escape the dist root.
    const filePath = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);
    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`Serving ${ROOT}/ at http://localhost:${server.port}`);
