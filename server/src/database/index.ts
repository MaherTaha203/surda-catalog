/**
 * SQLite connection + automatic initialization.
 *
 * Uses Node's built-in `node:sqlite` (Node 22+) — no native build step, so the
 * backend runs from a fresh `npm install` with nothing to compile.
 *
 * Automatic init (requirement #6): if `catalog.db` does not exist it is created
 * on first open, and the `products` table (#7) is created if missing. Both are
 * idempotent, so starting the server repeatedly is safe.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PRODUCTS_TABLE_DDL, PRODUCTS_INDEXES_DDL } from './schema.ts';

/** Absolute path to the SQLite file. Override with CATALOG_DB_PATH. */
export const DB_PATH =
  process.env.CATALOG_DB_PATH || resolve(process.cwd(), 'catalog.db');

export interface InitializedDatabase {
  db: DatabaseSync;
  dbPath: string;
  /** true when catalog.db did not exist and was created by this call. */
  created: boolean;
}

/**
 * Open (creating if needed) the catalog database and ensure the schema exists.
 */
export function initDatabase(dbPath: string = DB_PATH): InitializedDatabase {
  const created = !existsSync(dbPath);

  // Make sure the parent directory exists before SQLite creates the file.
  mkdirSync(dirname(dbPath), { recursive: true });

  // Opening a path with node:sqlite creates the file automatically if absent.
  const db = new DatabaseSync(dbPath);

  // Pragmas: WAL for concurrent reads while writing; enforce FKs for the future.
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Schema (idempotent).
  db.exec(PRODUCTS_TABLE_DDL);
  db.exec(PRODUCTS_INDEXES_DDL);

  return { db, dbPath, created };
}
