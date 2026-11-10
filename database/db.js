import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'library.db');
const dbExists = fs.existsSync(dbPath);


const db = new Database(dbPath);

db.pragma('foreign_keys = ON');


if (!dbExists) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
  console.log('База данных успешно создана и заполнена тестовыми данными.');
}

export default db;