#!/usr/bin/env node
// stdio MCP server: each IDE spawns its own copy, all copies share one SQLite file.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AGENTS, MAX_MESSAGE_CHARS, openDb, formatMessage } from "./db.mjs";

const ME = process.env.AGENT_NAME;
if (!AGENTS.includes(ME)) {
  console.error(`AGENT_NAME must be one of: ${AGENTS.join(", ")} (got "${ME}")`);
  process.exit(1);
}
const OTHERS = AGENTS.filter((a) => a !== ME);

const db = openDb();
const text = (t) => ({ content: [{ type: "text", text: t }] });

const HELP = `agent-chat: a shared message queue between IDE agents.

You are "${ME}". Other agents: ${OTHERS.join(", ")}.
A human starts each agent's turn manually (e.g. /check-message), so nobody is listening live.

Tools
- chat(to, message, reply_to?)  Send a message. "to" is one of: ${OTHERS.join(", ")}.
- get(number = 5)               Return the last N messages of the whole conversation
                                (from any agent, including yours), oldest first.
                                Messages addressed to you that were unread are tagged NEW
                                and are marked read by this call.
- chat_help()                   This text.

Conventions
- Keep messages short (max ${MAX_MESSAGE_CHARS} chars). For anything long (plans, diffs, research),
  write it to a file in the workspace and send the file path instead.
- Use reply_to with the id of the message you are answering.
- One message per task result. Do not reply just to acknowledge.
- If get reports older unread messages not shown, call get again with a larger number.`;

const server = new McpServer({ name: "agent-chat", version: "0.1.0" }, { instructions: HELP });

server.registerTool(
  "chat",
  {
    description: `Send a message to another agent (${OTHERS.join(", ")}). Call chat_help() if unsure.`,
    inputSchema: {
      to: z.enum(OTHERS),
      message: z.string().min(1).max(MAX_MESSAGE_CHARS),
      reply_to: z.number().int().positive().optional(),
    },
  },
  async ({ to, message, reply_to }) => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (sender, recipient, text, reply_to) VALUES (?, ?, ?, ?)")
      .run(ME, to, message, reply_to ?? null);
    return text(`sent #${lastInsertRowid} to ${to}`);
  }
);

server.registerTool(
  "get",
  {
    description: "Get the last N messages of the conversation and mark yours as read. Call chat_help() if unsure.",
    inputSchema: { number: z.number().int().min(1).max(50).default(5) },
  },
  async ({ number }) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const rows = db
        .prepare("SELECT *, (recipient = ? AND read_at IS NULL) AS was_unread FROM messages ORDER BY id DESC LIMIT ?")
        .all(ME, number)
        .reverse();
      const oldestShown = rows[0]?.id ?? Infinity;
      db.prepare("UPDATE messages SET read_at = datetime('now', 'localtime') WHERE recipient = ? AND read_at IS NULL AND id >= ?")
        .run(ME, oldestShown);
      const { hidden } = db
        .prepare("SELECT COUNT(*) AS hidden FROM messages WHERE recipient = ? AND read_at IS NULL")
        .get(ME);
      db.exec("COMMIT");

      if (!rows.length) return text("No messages yet.");
      const lines = rows.map(formatMessage);
      if (hidden) lines.push(`(${hidden} older unread message(s) for you not shown, call get with a larger number)`);
      return text(lines.join("\n"));
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
);

server.registerTool(
  "chat_help",
  { description: "How to use agent-chat (chat, get) and its conventions." },
  async () => text(HELP)
);

await server.connect(new StdioServerTransport());
