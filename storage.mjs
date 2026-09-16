import * as fs from "node:fs/promises";
import path from "node:path";

export async function createStorage(dataDir, connectionString) {
  let pool;
  if (connectionString) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 15000 });
    pool.on("error", () => console.error("Database connection interrupted."));
    await pool.query("CREATE TABLE IF NOT EXISTS app_documents (key text PRIMARY KEY, value jsonb NOT NULL)");
  }
  const isDocument = (file) => path.dirname(file) === dataDir;
  return {
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
      if (!pool || !isDocument(file)) return fs.writeFile(file, content);
      await pool.query("INSERT INTO app_documents (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [path.basename(file), content]);
    },
    async close() { await pool?.end(); }
  };
}
