import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const PLATFORMS = ["claude-code", "antigravity"];
export const DEFAULT_NAME = "main";
export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_MESSAGE_CHARS = 2000;

export const DB_PATH = process.env.AGENT_CHAT_DB ?? join(homedir(), "agent-chat", "chat.db");

// "antigravity/backend-lead" → { platform, name }; a bare platform means its "main" agent
export function parseAddress(address) {
  const [platform, name = DEFAULT_NAME, ...rest] = address.split("/");
  if (rest.length || !PLATFORMS.includes(platform) || !NAME_PATTERN.test(name)) return null;
  return { platform, name, address: `${platform}/${name}` };
}

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
    -- Rows from before named agents used bare platform names
    UPDATE messages SET sender = sender || '/${DEFAULT_NAME}' WHERE instr(sender, '/') = 0;
    UPDATE messages SET recipient = recipient || '/${DEFAULT_NAME}' WHERE instr(recipient, '/') = 0;
  `);
  return db;
}

export function knownAgents(db) {
  return db
    .prepare("SELECT sender AS a FROM messages UNION SELECT recipient FROM messages ORDER BY a")
    .all()
    .map((r) => r.a);
}

export function formatMessage(m, me) {
  const time = m.created_at.slice(5, 16);
  const reply = m.reply_to ? ` re #${m.reply_to}` : "";
  let tag = "";
  if (m.recipient === me) tag = m.was_unread ? " NEW" : "";
  else if (m.sender === me) tag = m.read_at ? " seen" : " pending";
  else if (!me) tag = m.read_at ? "" : " unread";
  return `[#${m.id} ${m.sender} → ${m.recipient}, ${time}${reply}${tag}] ${m.text}`;
}
