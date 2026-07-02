// /*
// Tujuan: Inisialisasi koneksi database SQLite lokal menggunakan Drizzle ORM dan better-sqlite3.
// Caller: Server Actions, API Routes, Pages
// Dependensi: drizzle-orm/better-sqlite3, better-sqlite3, lib/db/schema.ts
// Main Functions: Mengekspor instance `db` untuk interaksi database.
// Side Effects: Membuka file `local.db` pada filesystem lokal.
// */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('local.db');
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, { schema });
