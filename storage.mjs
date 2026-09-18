import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

async function writeLocalDocument(file, content) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, content); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

export async function createStorage(dataDir, connectionString) {
  let pool;
  let jobLocked = false;
  if (connectionString) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 15000 });
    pool.on("error", () => console.error("Database connection interrupted."));
    await pool.query("CREATE TABLE IF NOT EXISTS app_documents (key text PRIMARY KEY, value jsonb NOT NULL)");
  }
  const isDocument = (file) => path.dirname(file) === dataDir;
  return {
    async withJobLock(work) {
      if (!pool) {
        if (jobLocked) return false;
        jobLocked = true;
        try { await work(); return true; } finally { jobLocked = false; }
      }
      const client = await pool.connect();
      let locked = false;
      try {
        const result = await client.query("SELECT pg_try_advisory_lock(7153174) AS locked");
        locked = result.rows[0].locked;
        if (!locked) return false;
        await work();
        return true;
      } finally {
        try { if (locked) await client.query("SELECT pg_advisory_unlock(7153174)"); }
        finally { client.release(); }
      }
    },
    async readFile(file, encoding) {
      if (!pool || !isDocument(file)) return fs.readFile(file, encoding);
      const result = await pool.query("SELECT value FROM app_documents WHERE key = $1", [path.basename(file)]);
      if (result.rows.length) return JSON.stringify(result.rows[0].value);
      if (path.basename(file) === "store.json") return JSON.stringify({ drafts: [], published: [] });
      const error = new Error("Document not found");
      error.code = "ENOENT";
      throw error;
    },
    async writeFile(file, content) {
      if (!pool || !isDocument(file)) return writeLocalDocument(file, content);
      await pool.query("INSERT INTO app_documents (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [path.basename(file), content]);
    },
    async writeDocuments(documents) {
      if (!pool) {
        for (const [file, value] of documents) await writeLocalDocument(file, JSON.stringify(value));
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const [file, value] of documents) await client.query("INSERT INTO app_documents (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [path.basename(file), JSON.stringify(value)]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async close() { await pool?.end(); }
  };
}
