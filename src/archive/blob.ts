// Thin persistence seam for the cumulative archive tarball. The real store
// wraps Azure Blob Storage; tests inject a directory-backed fake, matching the
// repo's dependency-injection test style (fakes over module mocks).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";

export interface BlobStore {
  exists(name: string): Promise<boolean>;
  download(name: string, destPath: string): Promise<void>;
  upload(name: string, srcPath: string): Promise<void>;
  // Text convenience for callers that hold content in memory (the analytics
  // report) rather than on disk. downloadText returns null for a missing blob.
  uploadText(name: string, content: string): Promise<void>;
  downloadText(name: string): Promise<string | null>;
}

export function createAzureBlobStore(opts?: {
  connectionString?: string;
  container?: string;
}): BlobStore {
  const cs = opts?.connectionString ?? process.env.AZURE_STORAGE_CONNECTION_STRING;
  const container = opts?.container ?? process.env.AZURE_STORAGE_CONTAINER;
  if (!cs) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  if (!container) throw new Error("AZURE_STORAGE_CONTAINER is not set");
  const cc = BlobServiceClient.fromConnectionString(cs).getContainerClient(container);
  return {
    async exists(name) {
      return cc.getBlockBlobClient(name).exists();
    },
    async download(name, destPath) {
      await cc.getBlockBlobClient(name).downloadToFile(destPath);
    },
    async upload(name, srcPath) {
      await cc.getBlockBlobClient(name).uploadFile(srcPath);
    },
    async uploadText(name, content) {
      await cc.getBlockBlobClient(name).uploadData(Buffer.from(content, "utf8"));
    },
    async downloadText(name) {
      try {
        const buf = await cc.getBlockBlobClient(name).downloadToBuffer();
        return buf.toString("utf8");
      } catch (err) {
        // A missing blob is a normal "no previous log yet" case, not an error.
        const e = err as { statusCode?: number; code?: string };
        if (e.statusCode === 404 || e.code === "BlobNotFound") return null;
        throw err;
      }
    },
  };
}

export function createFakeBlobStore(dir: string): BlobStore {
  const at = (name: string) => join(dir, name);
  return {
    async exists(name) {
      return existsSync(at(name));
    },
    async download(name, destPath) {
      if (!existsSync(dirname(destPath))) mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(at(name), destPath);
    },
    async upload(name, srcPath) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      copyFileSync(srcPath, at(name));
    },
    async uploadText(name, content) {
      const dest = at(name);
      if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content, "utf8");
    },
    async downloadText(name) {
      const src = at(name);
      return existsSync(src) ? readFileSync(src, "utf8") : null;
    },
  };
}
