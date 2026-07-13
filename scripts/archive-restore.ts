// CLI: restore the cumulative archive from Azure Blob before building.
// No-op (clean start) when no prior state exists.
import { createAzureBlobStore } from "@/archive/blob";
import { restoreState } from "@/archive/state";

const store = createAzureBlobStore();
const res = await restoreState(store, { root: process.cwd(), tmpTar: "state-restore.tar.gz" });
console.log(
  res.restored ? "Restored state from Azure Blob" : "No prior state in Azure Blob; starting fresh",
);
