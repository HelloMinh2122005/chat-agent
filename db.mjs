import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const AGENTS = ["claude-code", "antigravity"];
export const MAX_MESSAGE_CHARS = 2000;

export const DB_PATH = process.env.AGENT_CHAT_DB ?? join(homedir(), "agent-chat", "chat.db");

export function openDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  // Both IDEs open this file from separate processes
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sender     TEXT NOT NULL,
      recipient  TEXT NOT NULL,
      text       TEXT NOT NULL,
      reply_to   INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      read_at    TEXT
    );
  `);
  return db;
}

export function formatMessage(m) {
  const time = m.created_at.slice(5, 16);
  const reply = m.reply_to ? ` re #${m.reply_to}` : "";
  const unread = m.was_unread ? " NEW" : "";
  return `[#${m.id} ${m.sender} → ${m.recipient}, ${time}${reply}${unread}] ${m.text}`;
}
