# Grok Toolkit

Two separately installable Grok Build plugins. Neither registers MCP, grants access, or starts desktop control automatically.

- [**AIClickThisShit**](plugins/aiclickthisshit/README.md) includes a local Linux desktop runtime. Register it manually with an already approved configuration. A Grok Bot cloud browser is not a local desktop.
- [**ILikeToWorkItWorkIt**](plugins/iliketoworkitworkit/README.md) includes the shared coordination workflow and seven analysis-only Grok Build roles. ECC, Caveman, GBrain and desktop tools are separate dependencies or integrations, not bundled or enabled.

## Grok Build

Inspect the source and two plugin manifests. For a checkout, install the Workit plugin from its local directory with `grok plugin install ./plugins/iliketoworkitworkit --trust` after reviewing it. The mirrored project files under `.grok/` are for hosts that load project skills directly. Use only one discovery mode to avoid duplicates. If project mode does not show the skill in `grok inspect --json`, use the packaged plugin.

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
