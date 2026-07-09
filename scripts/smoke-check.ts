// CLI: fail the workflow if today's edition is not live after deploy.
import { checkLiveSite } from "@/deploy/smoke";
import { todayIso } from "./author-edition";

const baseUrl = process.env.SITE_URL;
if (!baseUrl) throw new Error("SITE_URL is not set");
await checkLiveSite({ baseUrl, date: todayIso() });
console.log(`Smoke check passed: today's edition is live at ${baseUrl}`);
