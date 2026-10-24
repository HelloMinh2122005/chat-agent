#!/usr/bin/env node
// stdio MCP server: each IDE spawns its own copy, all copies share one SQLite file.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PLATFORMS, DEFAULT_NAME, NAME_PATTERN, MAX_MESSAGE_CHARS, openDb, parseAddress, knownAgents, formatMessage } from "./db.mjs";

const PLATFORM = process.env.AGENT_NAME;
if (!PLATFORMS.includes(PLATFORM)) {
  console.error(`AGENT_NAME must be one of: ${PLATFORMS.join(", ")} (got "${PLATFORM}")`);
  process.exit(1);
}

const db = openDb();
const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });
const myAddress = (name) => `${PLATFORM}/${name}`;
const nameField = z
  .string()
  .regex(NAME_PATTERN, "lowercase letters, digits and dashes")
  .default(DEFAULT_NAME);

const HELP = `agent-chat: a shared message queue between IDE agents.

Addresses are "platform/name". Platforms: ${PLATFORMS.join(", ")}.
You are on platform "${PLATFORM}". Your name is your agent/persona name in kebab-case
(e.g. backend-lead, react-tech-lead); use "${DEFAULT_NAME}" if you have none. Always pass the same name.
A human starts each agent's turn manually (e.g. /check-message), so nobody is listening live.

Tools
- chat(from, to, message, reply_to?)  Send as ${PLATFORM}/<from> to "platform/name"
                                      (a bare platform means its "${DEFAULT_NAME}" agent).
- get(me, number = 5)                 Your last N messages (sent to or by ${PLATFORM}/<me>), oldest first.
                                      NEW = addressed to you and unread (now marked read).
                                      pending / seen = sent by you, not yet / already read by the recipient.
- chat_help()                         This text, plus the agents seen so far.

Conventions
- Keep messages short (max ${MAX_MESSAGE_CHARS} chars). For anything long (plans, diffs, research),
  write it to a file in the workspace and send the file path instead.
- Use reply_to with the id of the message you are answering, and send the reply to its sender.
- One message per task result. Do not reply just to acknowledge.
- If get reports older unread messages not shown, call get again with a larger number.`;

const server = new McpServer({ name: "agent-chat", version: "0.2.0" }, { instructions: HELP });

server.registerTool(
  "chat",
  {
    description: `Send a message as ${PLATFORM}/<from> to another agent ("platform/name"). Call chat_help() if unsure.`,
    inputSchema: {
      from: nameField.describe("Your agent name, e.g. backend-lead"),
      to: z.string().describe('Recipient address, e.g. "antigravity/backend-lead" or "claude-code"'),
      message: z.string().min(1).max(MAX_MESSAGE_CHARS),
      reply_to: z.number().int().positive().optional(),
    },
  },
  async ({ from, to, message, reply_to }) => {
    const recipient = parseAddress(to);
    if (!recipient) return fail(`Invalid "to": ${to}. Use "platform/name" with platform one of ${PLATFORMS.join(", ")}.`);
    const sender = myAddress(from);
    if (recipient.address === sender) return fail("You cannot send a message to yourself.");
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (sender, recipient, text, reply_to) VALUES (?, ?, ?, ?)")
      .run(sender, recipient.address, message, reply_to ?? null);
    return text(`sent #${lastInsertRowid} ${sender} → ${recipient.address}`);
  }
);

server.registerTool(
  "get",
  {
    description: `Get your last N messages as ${PLATFORM}/<me> and mark the ones to you as read. Call chat_help() if unsure.`,
    inputSchema: {
      me: nameField.describe("Your agent name, e.g. backend-lead"),
      number: z.number().int().min(1).max(50).default(5),
    },
  },
  async ({ me, number }) => {
    const address = myAddress(me);
    db.exec("BEGIN IMMEDIATE");
    try {
      const rows = db
        .prepare(
          `SELECT *, (recipient = :me AND read_at IS NULL) AS was_unread FROM messages
           WHERE sender = :me OR recipient = :me ORDER BY id DESC LIMIT :n`
        )
        .all({ me: address, n: number })
        .reverse();
      const oldestShown = rows[0]?.id ?? Infinity;
      db.prepare("UPDATE messages SET read_at = datetime('now', 'localtime') WHERE recipient = ? AND read_at IS NULL AND id >= ?")
        .run(address, oldestShown);
      const { hidden } = db
        .prepare("SELECT COUNT(*) AS hidden FROM messages WHERE recipient = ? AND read_at IS NULL")
        .get(address);
      db.exec("COMMIT");

      if (!rows.length) return text(`No messages for ${address} yet.`);
      const lines = rows.map((m) => formatMessage(m, address));
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
  { description: "How to use agent-chat (chat, get), its conventions, and the agents seen so far." },
  async () => {
    const agents = knownAgents(db);
    return text(`${HELP}\n\nAgents seen so far: ${agents.length ? agents.join(", ") : "none"}`);
  }
);

await server.connect(new StdioServerTransport());
