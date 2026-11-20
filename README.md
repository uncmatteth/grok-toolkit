# Grok Toolkit

Two separately installable Grok Build plugins. Neither registers MCP, grants access, or starts desktop control automatically.

- [**AIClickThisShit**](plugins/aiclickthisshit/README.md) includes a local Linux desktop runtime. Register it manually with an already approved configuration. A Grok Bot cloud browser is not a local desktop.
- **ILikeToWorkItWorkIt** coordinates available, authorized tools and verifies their results. It can use AIClick when independently available; it does not require a bridge.

## Grok Build

Inspect the source and two plugin manifests. A repository checkout also exposes direct project skills in `.grok/skills/`. Choose either project discovery or individual plugins to avoid duplicate skill names. For a packaged local plugin point the documented `--plugin-dir` option to its directory under `plugins/`.

Add this repository in Grok Build as a custom marketplace:

```sh
grok plugin marketplace add uncmatteth/grok-toolkit
grok plugin install aiclickthisshit --trust
grok plugin install iliketoworkitworkit --trust
```

Install either workflow independently and only mark it trusted after reviewing its source. Check discovery with `grok inspect --json`. Discovery is not a live desktop check. For AIClick setup, see [the plugin’s local registration instructions](plugins/aiclickthisshit/README.md).

## Grok Bot

Use the [AIClickThisShit save prompt](grok-bot/aiclickthisshit-save-prompt.md) or [ILikeToWorkItWorkIt save prompt](grok-bot/iliketoworkitworkit-save-prompt.md) in the intended Bot. These prompts save private skills manually; they are not a template import or plugin installer. In that Bot, open **Connect apps → connected count → Private skills** to confirm the specific skill is present and enabled. Test a harmless workflow first. The repository alone does not publish a Bot template or submit either plugin to the official marketplace.

This is an independent community toolkit, not affiliated with or endorsed by xAI.

See [Grok Build plugins](https://docs.x.ai/build/features/skills-plugins-marketplaces) and [Grok Bot skills](https://docs.x.ai/grok-bot/skills-routines-and-automations).
