---
name: desktop
disable-model-invocation: true
description: Use AIClickThatShit for a requested local screen, mouse or keyboard task. Uses existing local permissions and does not make model calls.
---

# AIClickThatShit

Use this plugin's `bridge_status` and `desktop` MCP tools. Discovery and status
do not start desktop control. Never treat a successful connection as proof of a
completed task.

1. Call `bridge_status` and verify the intended computer.
2. Call `desktop` with `operation: start` only for the authorized desktop task.
   Reuse the existing installation and permissions. An active Pro relay owns
   the shared bridge; do not displace it or enable additional permissions.
3. Request a screenshot and inspect the actual target before input. Scope
   input to the user's task. Inspect the screen after input. Use
   `capture_evidence: true` when saved before/after evidence is requested or
   required. Explicit screenshots otherwise return images without saving them.
4. Verify the visible result and any relevant application readback. If an input
   fails or its outcome is uncertain, inspect before retrying; never replay it
   automatically.
5. Call `desktop` with `operation: stop`, then status. Confirm inactive and
   released ownership. Report cleanup failure separately from task completion.

This plugin exposes no shell, file or browser tools. It does not authorize
credential entry, unrelated actions, external messages, purchases, permission
changes or bypassing another tool's security denial. Keep existing browser
accounts signed in. Follow the current host and application approval rules.

If configuration is missing, report that exact blocker. Do not initialize a new
configuration or grant access just because the plugin is installed. The
package's README.md and SECURITY.md describe separate manual activation.
