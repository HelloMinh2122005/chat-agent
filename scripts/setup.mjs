#!/usr/bin/env node
// Idempotent setup: npm install, register MCP in Claude Code + Antigravity, install /check-message skills.
// Usage: node scripts/setup.mjs [--allow-permission]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = join(REPO, "server.mjs");
const HOME = homedir();
const allowPermission = process.argv.includes("--allow-permission");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node 22.13+ required (node:sqlite), found ${process.versions.node}`);
  process.exit(1);
}

const step = (msg) => console.log(`✓ ${msg}`);
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJson = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
};

// 1. Dependencies
execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: REPO, stdio: "inherit" });
step("npm install");

// 2. Claude Code MCP (user scope)
try {
  execFileSync("claude", ["mcp", "remove", "--scope", "user", "agent-chat"], { stdio: "ignore" });
} catch {}
try {
  execFileSync("claude", ["mcp", "add", "--scope", "user", "agent-chat", "-e", "AGENT_NAME=claude-code", "--", "node", "--no-warnings", SERVER], { stdio: "ignore" });
  step(`Claude Code MCP agent-chat → ${SERVER}`);
} catch {
  console.log("✗ Claude Code CLI (`claude`) not found, skipped Claude Code MCP registration");
}

// 3. Antigravity MCP
const agMcp = join(HOME, ".gemini", "config", "mcp_config.json");
const ag = readJson(agMcp, { mcpServers: {} });
ag.mcpServers ??= {};
ag.mcpServers["agent-chat"] = { command: "node", args: ["--no-warnings", SERVER], env: { AGENT_NAME: "antigravity" } };
writeJson(agMcp, ag);
step(`Antigravity MCP agent-chat → ${agMcp}`);

// 4. Global /check-message skills
const skills = [
  ["claude-code", join(HOME, ".claude", "skills", "check-message")],
  ["antigravity", join(HOME, ".gemini", "config", "skills", "check-message")],
];
for (const [agent, dest] of skills) {
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(REPO, "skills", agent, "check-message", "SKILL.md"), join(dest, "SKILL.md"));
  step(`/check-message skill (${agent}) → ${dest}`);
}

// 5. Optional: pre-approve agent-chat tools in Claude Code
if (allowPermission) {
  const settingsPath = join(HOME, ".claude", "settings.json");
  const settings = readJson(settingsPath, {});
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  if (!settings.permissions.allow.includes("mcp__agent-chat")) settings.permissions.allow.push("mcp__agent-chat");
  writeJson(settingsPath, settings);
  step(`permission mcp__agent-chat → ${settingsPath}`);
}

console.log("\nDone. Reload Antigravity and start a new Claude Code session to pick up the changes.");
