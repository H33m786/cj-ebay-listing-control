import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.NEON_EXPORT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set NEON_EXPORT_DATABASE_URL to the Neon pooled connection string before running this import.");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "data");
const storePath = path.join(dataDir, "store.json");
const backupPath = path.join(dataDir, `store.before-neon-import.${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });

try {
  const result = await pool.query("SELECT value FROM app_documents WHERE key = $1", ["store.json"]);
  if (!result.rows.length) throw new Error("Neon does not contain app_documents/store.json yet.");

  const remote = normalizeStore(result.rows[0].value);
  await mkdir(dataDir, { recursive: true });
  const local = await readLocalStore(storePath);
  const merged = {
    ...local,
    ...remote,
    drafts: mergeById(local.drafts, remote.drafts),
    published: mergeById(local.published, remote.published),
    repricing: { ...(local.repricing || {}), ...(remote.repricing || {}) }
  };

  await writeFile(backupPath, JSON.stringify(local, null, 2));
  await writeFile(storePath, JSON.stringify(merged, null, 2));
  console.log(`Imported Neon store. Drafts: ${merged.drafts.length}. Published: ${merged.published.length}. Backup: ${backupPath}`);
} finally {
  await pool.end();
}

async function readLocalStore(file) {
  try {
    return normalizeStore(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return { drafts: [], published: [] };
  }
}

function normalizeStore(value) {
  return {
    ...(value && typeof value === "object" ? value : {}),
    drafts: Array.isArray(value?.drafts) ? value.drafts : [],
    published: Array.isArray(value?.published) ? value.published : []
  };
}

function mergeById(local = [], remote = []) {
  const rows = new Map();
  for (const item of [...local, ...remote]) {
    const key = item?.id || item?.ebayListingId || item?.sku;
    if (key) rows.set(key, item);
  }
  return [...rows.values()].sort((a, b) => String(b.publishedAt || b.updatedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.updatedAt || a.createdAt || "")));
}
