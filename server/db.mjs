import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
export function openDB(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "studio.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,accent TEXT NOT NULL DEFAULT '#253951',domains TEXT NOT NULL DEFAULT '[]',stripe_account TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships(user_id TEXT REFERENCES users(id),org_id TEXT REFERENCES organizations(id),role TEXT NOT NULL,PRIMARY KEY(user_id,org_id));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),token TEXT NOT NULL UNIQUE,label TEXT NOT NULL,scopes TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),email TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),name TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,meta TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),name TEXT NOT NULL,niche TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'quote',draft TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,published INTEGER,active INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS versions(product_id TEXT REFERENCES products(id),revision INTEGER NOT NULL,org_id TEXT REFERENCES organizations(id),manifest TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(product_id,revision));
CREATE TABLE IF NOT EXISTS configurations(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),org_id TEXT REFERENCES organizations(id),product_id TEXT REFERENCES products(id),version INTEGER NOT NULL,name TEXT NOT NULL,selection TEXT NOT NULL,manifest TEXT NOT NULL,amount INTEGER NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),user_id TEXT REFERENCES users(id),configuration_id TEXT REFERENCES configurations(id),status TEXT NOT NULL,amount INTEGER NOT NULL,offer_revision INTEGER NOT NULL DEFAULT 0,offer_note TEXT NOT NULL DEFAULT '',checkout_id TEXT UNIQUE,checkout_url TEXT,payment_intent TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),user_id TEXT REFERENCES users(id),body TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,org_id TEXT REFERENCES organizations(id),request_key TEXT NOT NULL,provider_id TEXT,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,asset_id TEXT REFERENCES assets(id),created TEXT NOT NULL,UNIQUE(org_id,request_key));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,org_id TEXT REFERENCES organizations(id),actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created TEXT NOT NULL);
`);
  if (
    !db
      .prepare("PRAGMA table_info(products)")
      .all()
      .some((c) => c.name === "deleted_at")
  )
    db.exec("ALTER TABLE products ADD COLUMN deleted_at TEXT");
  return db;
}
