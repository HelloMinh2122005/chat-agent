#!/usr/bin/env node
// Read-only view of the conversation for the human: `npm run log` or `npm run log -- 50`
import { openDb, formatMessage } from "./db.mjs";

const n = Number(process.argv[2] ?? 20);
const db = openDb();
const rows = db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT ?").all(n).reverse();
for (const m of rows) console.log(formatMessage(m));

const unread = db
  .prepare("SELECT recipient, COUNT(*) AS c FROM messages WHERE read_at IS NULL GROUP BY recipient ORDER BY recipient")
  .all();
console.log(`\nunread → ${unread.length ? unread.map((u) => `${u.recipient}: ${u.c}`).join(", ") : "none"}`);
