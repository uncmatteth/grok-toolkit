# AIClickThisShit for Grok Build

Local Linux desktop control: an operator can explicitly ask Grok Build to inspect a visible target and perform scoped mouse or keyboard input on the logged-in Linux desktop. Not Grok Bot cloud computer use. Install discovers the skill; no hooks, no MCP auto-registration, no permission changes. No network endpoint, relay, automatic start or account credentials are part of this package.

## Supported host prerequisites

Linux, local Grok Build, Node.js 22+ and Python 3. Existing authorized AIClick local state and user-owned private configuration are required. Run as the same user in the intended graphical session. On Linux/X11 use PyAutoGUI, Pillow and an available screenshot backend (scrot or gnome-screenshot as needed by PyScreeze). Consented Wayland additionally requires a compatible RemoteDesktop/ScreenCast portal and PipeWire, PyGObject and GStreamer bindings; OS share prompts must be honored. Unsupported or denied portal access fails without fallback. This candidate does not claim validated cross-platform or compositor support. macOS, Windows, cloud and headless production use are not supported by this package.

## Manual activation

1. Review the exact local package and confirm an already approved private AIClick config, including its existing shared state directory. Do not create a second ownership state for the same desktop or edit permissions to make it work. The executable requires an explicit absolute config path.
2. In a local Grok Build workspace only, after review, register the inspected files manually (replace both example paths, not with a URL):

   ```sh
   grok mcp add --scope project aiclickthisshit -- node /absolute/reviewed/package/runtime/codex-desktop-mcp.js --config /absolute/approved/private-config.json
   ```

3. Check discovery with `grok inspect --json`. Ask for the desktop skill and verify `bridge_status` shows the intended host. Start only after authorization for a specific visible task. Verify outcome, then stop and confirm ownership released. Do not start if another agent owns desktop. Registration starts no desktop session.
4. Before using on important windows, independently verify a disposable fixture under the same supported host; never take unrequested captures or enter secrets. Remove the project registration separately if you stop using it.

## Privacy and review

Desktop operations require a pre-existing desktop grant and are local stdio. This is not an authentication or security workaround. Requested screenshot bytes are visible to the caller and may enter its transcript or configured model processing; no screenshot is requested merely by discovery. Optional capture evidence saves screenshots to existing private state and should not be enabled on sensitive windows. Limit access to reviewed local packages and config files. See SECURITY.md and LICENSE.
