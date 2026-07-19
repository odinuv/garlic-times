import type { Pick } from "@/newsletter/types";

const SOURCE_LABEL: Record<Pick["source"], string> = { cnn: "CNN", fox: "Fox" };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function subjectFor(picks: Pick[]): string {
  const top = [...picks].sort((a, b) => b.score - a.score)[0];
  return top
    ? `The Garlic Times · Saturday Special: ${top.title}`
    : "The Garlic Times · Saturday Special";
}

export function renderDigest(
  picks: Pick[],
  meta: { displayDate: string },
): { subject: string; html: string; text: string } {
  const rows = picks
    .map(
      (p) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #111;">
        <div style="font:11px/1.4 Georgia,serif;letter-spacing:.15em;text-transform:uppercase;color:#555;">
          ${esc(SOURCE_LABEL[p.source])} · ${esc(p.weekday)}
        </div>
        <a href="${esc(p.url)}" style="font:bold 20px/1.25 Georgia,serif;color:#111;text-decoration:none;">
          ${esc(p.title)}
        </a>
        ${p.dek ? `<div style="font:italic 13px/1.4 Georgia,serif;color:#333;margin-top:4px;">${esc(p.dek)}</div>` : ""}
      </td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbf9f3;border:1px solid #111;">
      <tr><td style="padding:24px 28px;text-align:center;border-bottom:3px double #111;">
        <div style="font:bold 30px/1 Georgia,serif;letter-spacing:.04em;">The Garlic Times</div>
        <div style="font:11px/1.6 Georgia,serif;letter-spacing:.3em;text-transform:uppercase;margin-top:6px;">
          Saturday Special · ${esc(meta.displayDate)}
        </div>
      </td></tr>
      <tr><td style="padding:8px 28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        <p style="font:12px/1.5 Georgia,serif;color:#555;margin:20px 0 0;">
          Read the full editions at
          <a href="https://www.thegarlictimes.com/" style="color:#111;">thegarlictimes.com</a>.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;

  const text = [
    `The Garlic Times — Saturday Special`,
    meta.displayDate,
    "",
    ...picks.map(
      (p) => `${p.rank}. [${SOURCE_LABEL[p.source]} · ${p.weekday}] ${p.title}\n   ${p.url}`,
    ),
    "",
    "Read the full editions at https://www.thegarlictimes.com/",
  ].join("\n");

  return { subject: subjectFor(picks), html, text };
}
