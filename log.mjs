#!/usr/bin/env node
// Read-only view of the conversation for the human: `npm run log` or `npm run log -- 50`
import { openDb, formatMessage, AGENTS } from "./db.mjs";

const n = Number(process.argv[2] ?? 20);
const db = openDb();
const rows = db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT ?").all(n).reverse();
for (const m of rows) console.log(formatMessage({ ...m, was_unread: !m.read_at }));

const unread = AGENTS.map((a) => {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE recipient = ? AND read_at IS NULL").get(a);
  return `${a}: ${c}`;
});
console.log(`\nunread → ${unread.join(", ")}`);
