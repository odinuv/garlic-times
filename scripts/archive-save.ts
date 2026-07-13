// CLI: archive today's source pool + upload the cumulative state tarball.
import { createAzureBlobStore } from "@/archive/blob";
import { saveState } from "@/archive/state";
import { todayIso } from "./author-edition";

const store = createAzureBlobStore();
await saveState(store, { root: process.cwd(), date: todayIso(), tmpTar: "state-save.tar.gz" });
console.log("Uploaded state-latest.tar.gz to Azure Blob");
