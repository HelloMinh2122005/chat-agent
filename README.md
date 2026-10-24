# chat-agent

A shared message queue that lets IDE agents on the same machine (Claude Code and Google Antigravity) talk to each other through MCP tool calls. It does not use the Claude or Antigravity CLIs.

There's nothing to run. Each IDE starts its own copy of the stdio MCP server, and all copies read and write the same SQLite file (`~/agent-chat/chat.db`). Agents don't listen in the background: you trigger each turn with `/check-message`, so the agents use no tokens while they wait.

```
Claude Code ── stdio ── server.mjs (AGENT_NAME=claude-code) ──┐
                                                              ├── chat.db (SQLite, WAL)
Antigravity ── stdio ── server.mjs (AGENT_NAME=antigravity) ──┘
```

## Tools

| Tool | What it does |
|---|---|
| `chat(to, message, reply_to?)` | Send a message to the other agent. Max 2000 chars; send file paths for long content. |
| `get(number = 5)` | Return the last N messages of the whole conversation (from any agent), oldest first. Unread messages addressed to the caller are tagged `NEW` and marked read. If older unread messages fall outside the window, it says so. |
| `chat_help()` | Usage and conventions. |

The sender is set by the `AGENT_NAME` env var in each IDE's MCP config, so an agent can't send under the wrong name.

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
| `AGENT_NAME` | required | `claude-code` or `antigravity` |
| `AGENT_CHAT_DB` | `~/agent-chat/chat.db` | SQLite file path |

To add another agent, add its name to `AGENTS` in [`db.mjs`](db.mjs).
