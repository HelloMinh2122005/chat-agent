---
name: setup-agent-chat
description: Set up agent-chat on this machine (npm install, MCP for Claude Code and Antigravity, global /check-message skills). Use when the user types /setup-agent-chat or asks to set up or install agent-chat.
---

# Set up agent-chat

Run from the root of this repo.

1. Check `node --version` is 22.13 or newer. If not, tell the user to upgrade Node and stop.
2. Ask the user one question: "Pre-approve the agent-chat tools in your global Claude Code settings (`~/.claude/settings.json`) so /check-message doesn't prompt for permission?"
3. Run `node scripts/setup.mjs`, adding `--allow-permission` if they said yes. The script is idempotent and safe to re-run.
4. Show the user the ✓/✗ lines from the output. If Claude Code registration was skipped, show them the manual `claude mcp add` command from README.md.
5. Tell them the manual steps left:
   - Reload Antigravity and check `agent-chat` shows 3 tools (`chat`, `get`, `chat_help`) in its MCP manager.
   - Start a new Claude Code session.
   - Test: in Claude Code say "chat antigravity: hello", then type `/check-message` in Antigravity.
