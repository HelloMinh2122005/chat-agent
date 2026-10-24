#!/usr/bin/env node
// Read-only web view of the conversation: `npm start` opens http://127.0.0.1:3434
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { openDb, AGENTS } from "./db.mjs";

const PORT = Number(process.env.PORT ?? 3434);
const db = openDb();

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Chat</title>
<style>
  :root { --bg: #f6f7f9; --card: #fff; --text: #1d2330; --muted: #6b7280; --line: #e5e7eb;
          --cc: #d97757; --ag: #4285f4; --new: #16a34a; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111318; --card: #1b1e25; --text: #e6e8ec; --muted: #9aa1ad; --line: #2a2f39; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
  header { position: sticky; top: 0; background: var(--card); border-bottom: 1px solid var(--line);
           padding: 12px 16px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 16px; margin: 0; flex: 1; }
  .badge { font-size: 13px; color: var(--muted); }
  .badge b { color: var(--text); }
  main { max-width: 760px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 85%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
  .msg.claude-code { align-self: flex-start; border-left: 3px solid var(--cc); }
  .msg.antigravity { align-self: flex-end; border-right: 3px solid var(--ag); }
  .meta { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
  .meta .who { font-weight: 600; }
  .claude-code .who { color: var(--cc); }
  .antigravity .who { color: var(--ag); }
  .unread { color: var(--new); font-weight: 600; }
  .text { white-space: pre-wrap; word-break: break-word; }
  .empty { color: var(--muted); text-align: center; margin-top: 40px; }
</style>
</head>
<body>
<header><h1>Agent Chat</h1><span class="badge" id="unread"></span></header>
<main id="list"></main>
<script>
  const list = document.getElementById("list");
  const unread = document.getElementById("unread");
  let lastSig = "";
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function refresh() {
    try {
      const data = await (await fetch("/api/messages")).json();
      unread.innerHTML = Object.entries(data.unread).map(([a, n]) => a + " unread: <b>" + n + "</b>").join(" · ");
      const sig = JSON.stringify(data.messages.map((m) => [m.id, m.read_at]));
      if (sig === lastSig) return;
      lastSig = sig;
      const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 40;
      list.innerHTML = data.messages.length
        ? data.messages.map((m) =>
            '<div class="msg ' + m.sender + '"><div class="meta"><span class="who">' + m.sender + "</span> → " + m.recipient +
            " · #" + m.id + (m.reply_to ? " · re #" + m.reply_to : "") + " · " + m.created_at.slice(5, 16) +
            (m.read_at ? "" : ' · <span class="unread">unread</span>') +
            '</div><div class="text">' + esc(m.text) + "</div></div>").join("")
        : '<p class="empty">No messages yet.</p>';
      if (atBottom) scrollTo(0, document.body.scrollHeight);
    } catch {}
  }
  refresh();
  setInterval(refresh, 2000);
</script>
</body>
</html>`;

createServer((req, res) => {
  if (req.url === "/api/messages") {
    const messages = db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 200").all().reverse();
    const unread = Object.fromEntries(
      AGENTS.map((a) => [a, db.prepare("SELECT COUNT(*) AS c FROM messages WHERE recipient = ? AND read_at IS NULL").get(a).c])
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ messages, unread }));
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(PAGE);
}).listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Agent Chat UI → ${url}  (Ctrl+C to stop)`);
  const opener = { darwin: "open", win32: "explorer" }[process.platform] ?? "xdg-open";
  spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
});
