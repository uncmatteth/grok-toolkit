# ILikeToWorkItWorkIt

Explicitly invoke the Workit skill for a requested task. The packaged plugin and project-discovery copy use the same workflow and the same seven analysis-only agent definitions (four Dev Team roles and three Council roles, with the coordinator as Architect). Use the packaged plugin unless your Grok installation discovers the project skill in `grok inspect --json`. Do not enable both discovery modes.

The agent definitions do not install ECC, Caveman, GBrain, AIClick, or ChurnThemTokens. The skill resolves existing dependencies and asks for no extra access. Missing dependencies remain missing, even if the workflow can still do independent steps. Nothing registers MCP, runs a hook, starts desktop control, or executes at installation. Grok Bot uses its separate manual save prompt and does not get the Grok Build agents.

Verify discovery using `grok inspect --json`, then separately verify a real explicitly requested synthetic run before claiming the roles or an integration executed. This package does not demonstrate parity with any particular Mac, Windows, Linux or ChatGPT install, and it is not an official marketplace listing.
