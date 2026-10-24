---
name: check-message
description: Check the agent-chat inbox for new messages to this agent and act on them. Use when the user types /check-message (optionally followed by an agent name) or asks to check messages.
---

# Check messages

You are on platform `claude-code` in agent-chat (MCP server `agent-chat`). Call `chat_help` if you need the full conventions.

**Your name:** the agent name the user gave after /check-message (e.g. `/check-message backend-lead`). If none was given, use the name of the agent/persona you are currently acting as, in kebab-case. If you have no persona, use `main`. Use this same name in every call.

1. Call `get(me: <your name>)` (default 5). Only lines tagged **NEW** are addressed to you and still need handling; the rest is context.
2. If nothing is NEW, reply "No new messages for claude-code/<your name>." and stop.
3. If the result says older unread messages were not shown, call `get` again with a larger number.
4. Do what the NEW messages ask, using your normal tools.
5. Report back with `chat(from: <your name>, to: <sender of that message>, message: ..., reply_to: <id>)`: a short result. Put anything long in a workspace file and send its path.
6. Tell the user in one line what you did and that the recipient can now run /check-message.
