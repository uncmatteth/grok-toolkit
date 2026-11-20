# Grok Toolkit

Two separately installable, instructions-only workflows: **AIClickThisShit** and **ILikeToWorkItWorkIt**. Neither installs a runtime, registers MCP, opens a connection, grants access, or runs automatically.

- **AIClickThisShit** works only when the session already has an authorized computer tool that reaches the intended target. A Grok Bot cloud browser is not a local desktop.
- **ILikeToWorkItWorkIt** coordinates available, authorized tools and verifies their results. It can use AIClick when independently available; it does not require a bridge.

## Grok Build

Inspect the source and two plugin manifests. A repository checkout also exposes direct project skills in `.grok/skills/`. Choose either project discovery or individual plugins to avoid duplicate skill names. For a packaged local plugin point the documented `--plugin-dir` option to its directory under `plugins/`.

Add this repository in Grok Build as a custom marketplace:

```sh
grok plugin marketplace add uncmatteth/grok-toolkit
grok plugin install aiclickthisshit --trust
grok plugin install iliketoworkitworkit --trust
```

Install either workflow independently and only mark it trusted after reviewing its source. Check discovery with `grok inspect --json`. Discovery is not a live desktop check.

## Grok Bot

Use the [AIClickThisShit save prompt](grok-bot/aiclickthisshit-save-prompt.md) or [ILikeToWorkItWorkIt save prompt](grok-bot/iliketoworkitworkit-save-prompt.md) in the intended Bot. These prompts save private skills manually; they are not a template import or plugin installer. In that Bot, open **Connect apps → connected count → Private skills** to confirm the specific skill is present and enabled. Test a harmless workflow first. The repository alone does not publish a Bot template or submit either plugin to the official marketplace.

This is an independent community toolkit, not affiliated with or endorsed by xAI.

See [Grok Build plugins](https://docs.x.ai/build/features/skills-plugins-marketplaces) and [Grok Bot skills](https://docs.x.ai/grok-bot/skills-routines-and-automations).
