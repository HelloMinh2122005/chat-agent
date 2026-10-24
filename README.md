# chat-agent

A shared message queue that lets IDE agents on the same machine (Claude Code and Google Antigravity) talk to each other through MCP tool calls. It does not use the Claude or Antigravity CLIs.

There's nothing to run. Each IDE starts its own copy of the stdio MCP server, and all copies read and write the same SQLite file (`~/agent-chat/chat.db`). Agents don't listen in the background: you trigger each turn with `/check-message`, so the agents use no tokens while they wait.

```
Claude Code ── stdio ── server.mjs (AGENT_NAME=claude-code) ──┐
                                                              ├── chat.db (SQLite, WAL)
Antigravity ── stdio ── server.mjs (AGENT_NAME=antigravity) ──┘
```

## Tools

Every agent has an address `platform/name`, e.g. `antigravity/backend-lead` or `claude-code/frontend-lead`. The **platform** is fixed by the `AGENT_NAME` env var in each IDE's MCP config, so an agent can't claim to be on another IDE. The **name** is the agent/persona name (kebab-case), passed by the agent on each call, because one IDE can host many personas. It defaults to `main`.

| Tool | What it does |
|---|---|
| `chat(from, to, message, reply_to?)` | Send as `<platform>/<from>` to `to` (`"platform/name"`; a bare platform means its `main` agent). Max 2000 chars; send file paths for long content. |
| `get(me, number = 5)` | Your last N messages (sent to or by `<platform>/<me>`), oldest first. `NEW` = addressed to you and unread (now marked read). `pending` / `seen` = sent by you, not yet / already read by the recipient. Other agents' messages are never shown or marked read. |
| `chat_help()` | Usage, conventions, and the agents seen so far. |

`/check-message` takes an optional name: `/check-message backend-lead`. Without one, the agent uses its current persona name, or `main`.

## Requirements

- Node.js 22.13+ (it uses the built-in `node:sqlite`)

## Setup

```bash
git clone https://github.com/HelloMinh2122005/chat-agent.git ~/agent-chat
cd ~/agent-chat && claude
```

Then type `/setup-agent-chat` in Claude Code. It runs [`scripts/setup.mjs`](scripts/setup.mjs), which installs dependencies, registers the MCP server in Claude Code and Antigravity, and installs the global `/check-message` skills. Afterwards, reload Antigravity and start a new Claude Code session.

Without Claude Code, run `node scripts/setup.mjs` (add `--allow-permission` to pre-approve the tools in `~/.claude/settings.json`).

### Manual setup

```bash
npm install
```

#### Claude Code

```bash
claude mcp add --scope user agent-chat -e AGENT_NAME=claude-code -- node --no-warnings ~/agent-chat/server.mjs
```

Optional: add `"mcp__agent-chat"` to `permissions.allow` in `~/.claude/settings.json` to skip permission prompts.

#### Antigravity

Add to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "agent-chat": {
      "command": "node",
      "args": ["--no-warnings", "/home/<you>/agent-chat/server.mjs"],
      "env": { "AGENT_NAME": "antigravity" }
    }
  }
}
```

#### `/check-message` skills

Copy the skills from [`skills/`](skills/) to the global skill folders:

```bash
mkdir -p ~/.claude/skills/check-message ~/.gemini/config/skills/check-message
cp skills/claude-code/check-message/SKILL.md ~/.claude/skills/check-message/
cp skills/antigravity/check-message/SKILL.md ~/.gemini/config/skills/check-message/
```

## Usage

1. In Claude Code, ask it to send a task: *"chat antigravity: research escrow flows, write to my-note/escrow.md"*.
2. In Antigravity, type `/check-message`. It reads the `NEW` messages, does the work, and replies.
3. Back in Claude Code, type `/check-message`.

To watch the conversation yourself (optional; the agents don't need it):

```bash
npm start
```

This opens a live, read-only web view at http://127.0.0.1:3434. Viewing never marks messages as read. Without a browser, `npm run log` prints the last 20 messages in the terminal.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `AGENT_NAME` | required | Platform: `claude-code` or `antigravity` |
| `AGENT_CHAT_DB` | `~/agent-chat/chat.db` | SQLite file path |

Named agents need no setup. To add another IDE platform, add it to `PLATFORMS` in [`db.mjs`](db.mjs).
