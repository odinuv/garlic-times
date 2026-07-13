// Thin persistence seam for the cumulative archive tarball. The real store
// wraps Azure Blob Storage; tests inject a directory-backed fake, matching the
// repo's dependency-injection test style (fakes over module mocks).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";

export interface BlobStore {
  exists(name: string): Promise<boolean>;
  download(name: string, destPath: string): Promise<void>;
  upload(name: string, srcPath: string): Promise<void>;
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
  };
}
