import path from "path";
import fs from "fs";
import os from "os";

let cachedDataDir: string | null = null;

/**
 * Returns a guaranteed writable directory for persistent or temporary JSON stores.
 * In local development: uses `<projectRoot>/data`.
 * In Vercel serverless / AWS Lambda (/var/task): `<projectRoot>` is strictly read-only,
 * so writing or creating directories in `/var/task` throws ENOENT/EROFS.
 * This helper automatically falls back to `os.tmpdir()/studelect-data` on serverless.
 */
export function getDataDir(): string {
  if (cachedDataDir) {
    try {
      if (!fs.existsSync(cachedDataDir)) {
        fs.mkdirSync(cachedDataDir, { recursive: true });
      }
      return cachedDataDir;
    } catch (_) {}
  }

  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === "function" && process.cwd().startsWith("/var/task"));

  if (isServerless) {
    const tmpDir = path.join(os.tmpdir(), "studelect-data");
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch (_) {}
    cachedDataDir = tmpDir;
    return tmpDir;
  }

  const localDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    cachedDataDir = localDir;
    return localDir;
  } catch (_) {
    // If local mkdir fails for any reason (read-only container, permission denied), fallback to /tmp
    const tmpDir = path.join(os.tmpdir(), "studelect-data");
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch (_) {}
    cachedDataDir = tmpDir;
    return tmpDir;
  }
}

/**
 * Safely reads a JSON file from the active data dir, with fallback to bundled files.
 * NEVER throws ENOENT or crashes the application.
 */
export function safeReadDataJson<T>(fileName: string, fallback: T): T {
  try {
    const activeDir = getDataDir();
    const activeFile = path.join(activeDir, fileName);

    if (fs.existsSync(activeFile)) {
      const raw = fs.readFileSync(activeFile, "utf8");
      if (raw && raw.trim().length > 0) return JSON.parse(raw);
    }

    // Fallback: check if the file was bundled in process.cwd()/data
    try {
      const bundledFile = path.join(process.cwd(), "data", fileName);
      if (fs.existsSync(bundledFile)) {
        const raw = fs.readFileSync(bundledFile, "utf8");
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          // Seed to active dir for subsequent writes
          try {
            fs.writeFileSync(activeFile, raw, "utf8");
          } catch (_) {}
          return parsed;
        }
      }
    } catch (_) {}

    return fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Safely writes a JSON file atomically.
 * NEVER throws ENOENT or EROFS.
 */
export function safeWriteDataJson(fileName: string, data: any): void {
  try {
    const activeDir = getDataDir();
    const activeFile = path.join(activeDir, fileName);
    const content = JSON.stringify(data, null, 2);
    const tempFile = `${activeFile}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;

    try {
      fs.writeFileSync(tempFile, content, "utf8");
      try {
        fs.renameSync(tempFile, activeFile);
      } catch (_) {
        fs.writeFileSync(activeFile, content, "utf8");
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch (_) {}
      }
    } catch (_) {
      try {
        fs.writeFileSync(activeFile, content, "utf8");
      } catch (_) {}
    }
  } catch (err) {
    console.warn(`safeWriteDataJson warning for ${fileName}:`, err);
  }
}
