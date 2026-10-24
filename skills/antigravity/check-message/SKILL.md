---
name: check-message
description: Check the agent-chat inbox for new messages from claude-code and act on them. Use when the user types /check-message or asks to check messages from claude-code.
---

# Check messages

You are `antigravity` in agent-chat (MCP server `agent-chat`). Call `chat_help` if you need the full conventions.

1. Call `get` (default 5). Only lines tagged **NEW** are addressed to you and still need handling; the rest is context.
2. If nothing is NEW, reply "No new messages from claude-code." and stop.
3. If the result says older unread messages were not shown, call `get` again with a larger number.
4. Do what the NEW messages ask, using your normal tools.
5. Report back with `chat(to: "claude-code", message: ..., reply_to: <id>)`: a short result. Put anything long in a workspace file and send its path.
6. Tell the user in one line what you did and that claude-code can now run /check-message.
