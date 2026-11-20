#!/usr/bin/env python3
"""Optional local GUI tools. No AI client, credential extraction or web proxy."""
import argparse
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import sys


def doctor():
    result = {
        "python": sys.version.split()[0],
        "pyautogui_installed": importlib.util.find_spec("pyautogui") is not None,
        "pillow_installed": importlib.util.find_spec("PIL") is not None,
        "wayland_portal_libraries_installed": importlib.util.find_spec("gi") is not None,
        "wayland_detected": bool(os.environ.get("WAYLAND_DISPLAY")),
        "display_detected": bool(os.environ.get("DISPLAY")) or sys.platform in ("darwin", "win32"),
        "browser_and_desktop_live_verification": "not performed by doctor",
    }
    if sys.platform == "darwin":
        result["macos_permissions"] = macos_permissions()
    return result


def macos_permissions():
    """Read this process's privacy grants without opening a permission prompt."""
    import ctypes
    result = {}
    for name, framework, symbol in (
        ("screen_recording", "CoreGraphics", "CGPreflightScreenCaptureAccess"),
        ("accessibility", "ApplicationServices", "AXIsProcessTrusted"),
    ):
        try:
            library = ctypes.CDLL(f"/System/Library/Frameworks/{framework}.framework/{framework}")
            function = getattr(library, symbol)
            function.argtypes = []
            function.restype = ctypes.c_bool
            result[name] = bool(function())
        except (OSError, AttributeError):
            result[name] = None
    return result


def request_macos_screen_recording():
    """Ask macOS to present its normal consent flow; never grant access here."""
    import ctypes
    try:
        library = ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
        request = library.CGRequestScreenCaptureAccess
        request.argtypes = []
        request.restype = ctypes.c_bool
        return bool(request())
    except (OSError, AttributeError):
        return False


def request_macos_accessibility():
    """Ask the system to show Accessibility consent, using Apple's public API."""
    import ctypes
    try:
        services = ctypes.CDLL("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        core = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        pointers = ctypes.POINTER(ctypes.c_void_p)
        core.CFDictionaryCreate.argtypes = [ctypes.c_void_p, pointers, pointers, ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p]
        core.CFDictionaryCreate.restype = ctypes.c_void_p
        keys = (ctypes.c_void_p * 1)(ctypes.c_void_p.in_dll(services, "kAXTrustedCheckOptionPrompt").value)
        values = (ctypes.c_void_p * 1)(ctypes.c_void_p.in_dll(core, "kCFBooleanTrue").value)
        options = core.CFDictionaryCreate(None, keys, values, 1, None, None)
        if not options:
            return False
        core.CFRelease.argtypes = [ctypes.c_void_p]
        core.CFRelease.restype = None
        try:
            request = services.AXIsProcessTrustedWithOptions
            request.argtypes = [ctypes.c_void_p]
            request.restype = ctypes.c_bool
            return bool(request(options))
        finally:
            core.CFRelease(options)
    except (OSError, AttributeError, ValueError):
        return False


def capture_screen(gui, request_permission=False):
    try:
        return gui.screenshot()
    except OSError as error:
        if sys.platform == "darwin" and macos_permissions()["screen_recording"] is False:
            if request_permission and request_macos_screen_recording():
                return gui.screenshot()
            raise ValueError("macOS Screen Recording is not allowed for this app. Enable the requesting app in System Settings > Privacy & Security > Screen & System Audio Recording, then quit and reopen it and try again.") from error
        raise


def image_result(image):
    width, height = image.size
    image = image.convert("RGB")
    image.thumbnail((1600, 1600))
    # Chrome native messaging responses are capped at 1 MiB including base64.
    # Keep the image well below that limit even for noisy/high-detail screens.
    while True:
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=72)
        if output.tell() <= 650_000 or max(image.size) <= 480:
            break
        image.thumbnail((int(image.width * .8), int(image.height * .8)))
    return {
        "_image": base64.b64encode(output.getvalue()).decode("ascii"),
        "mimeType": "image/jpeg",
        "native_width": width, "native_height": height,
        "image_width": image.width, "image_height": image.height,
        "coordinate_note": "Mouse tools use native screen coordinates, not resized image coordinates.",
    }


class Backend:
    def __init__(self, state):
        self.state = Path(state)
        self.gui = None
        self.portal = None
        self.desktop_started = False
        self.parent_window = ""
        self.approval_timeout = 120000

    def desktop(self, a):
        if os.environ.get("WAYLAND_DISPLAY"):
            return self.wayland_desktop(a)
        op = a["operation"]
        if op == "stop":
            self.desktop_started = False
            return {"stopped": True, "wayland": False}
        if not self.desktop_started and op not in ("start", "status"):
            raise ValueError("Desktop sharing is stopped. Call desktop start")
        if self.gui is None:
            import pyautogui
            self.gui = pyautogui
            self.gui.FAILSAFE = True
        gui = self.gui
        if op == "start":
            if sys.platform == "darwin" and macos_permissions()["accessibility"] is False:
                request_macos_accessibility()
            # A real frame is required before the extension labels this ready.
            capture_screen(gui, request_permission=True)
            if sys.platform == "darwin" and macos_permissions()["accessibility"] is False:
                raise ValueError("macOS Accessibility is not allowed for this app. Enable the requesting app in System Settings > Privacy & Security > Accessibility, then quit and reopen it and try again.")
            self.desktop_started = True
            op = "status"
        width, height = gui.size()
        if op == "status":
            return {"active": self.desktop_started, "width": width, "height": height, "failsafe": True, "primary_display_only": True}
        if op == "screenshot":
            return image_result(capture_screen(gui))
        if op in ("move", "click", "double_click", "drag"):
            x, y = a["x"], a["y"]
            if not (0 <= x < width and 0 <= y < height):
                raise ValueError("Coordinates are outside the primary screen")
            if op == "move":
                gui.moveTo(x, y, duration=0.2)
            elif op == "drag":
                gui.dragTo(x, y, duration=0.4, button=a.get("button", "left"))
            else:
                gui.click(x, y, clicks=2 if op == "double_click" else 1, interval=0.1, button=a.get("button", "left"))
        elif op == "scroll":
            gui.scroll(a.get("amount", 1))
        elif op == "press":
            if a["key"] not in gui.KEYBOARD_KEYS:
                raise ValueError("Unsupported key name")
            gui.press(a["key"])
        elif op == "hotkey":
            keys = a["keys"]
            if not keys or any(key not in gui.KEYBOARD_KEYS for key in keys):
                raise ValueError("Unsupported hotkey")
            gui.hotkey(*keys)
        elif op == "type":
            if not a["text"].isascii():
                raise ValueError("Desktop typing supports ASCII; use browser fill for Unicode. Clipboard contents are not read or replaced.")
            if sys.platform == "darwin":
                # macOS adds delays for key-down/up and shift events. Refuse
                # oversized input before typing; leave room in the 45s request.
                per_char = 0.01 + 4 * max(0.0, float(gui.DARWIN_CATCH_UP_TIME))
                limit = max(0, int((20 - max(0.0, float(gui.PAUSE))) / per_char))
                if len(a["text"]) > limit:
                    raise ValueError(f"Split macOS typing into chunks of at most {limit} ASCII characters, or use browser fill. No text was typed.")
            # Cap the additional typing delay at five seconds.
            gui.write(a["text"], interval=min(0.01, 5 / max(1, len(a["text"]))))
        else:
            raise ValueError("Unsupported desktop operation")
        return {"operation": op, "completed": True}

    def wayland_desktop(self, a):
        if self.portal is None:
            from wayland_portal import WaylandPortal
            portal = WaylandPortal(parent_window=self.parent_window, approval_timeout=self.approval_timeout)
            self.portal = portal
        portal = self.portal
        op = a["operation"]
        if op == "status":
            return portal.status()
        if op == "start":
            return portal.start()
        if op == "stop":
            portal.stop()
            return {"stopped": True, "wayland": True}
        if op == "screenshot":
            return image_result(portal.screenshot())
        portal.require_active()
        if op in ("move", "click", "double_click", "drag"):
            if op == "drag":
                # Match dragTo: drag from the current pointer position.
                portal.check_point(a["x"], a["y"])
                portal.button(a.get("button", "left"), True)
                try:
                    portal.move(a["x"], a["y"])
                finally:
                    portal.button(a.get("button", "left"), False)
            else:
                portal.move(a["x"], a["y"])
            if op in ("click", "double_click"):
                for _ in range(2 if op == "double_click" else 1):
                    portal.button(a.get("button", "left"), True)
                    portal.button(a.get("button", "left"), False)
        elif op == "scroll":
            amount = a.get("amount", 1)
            if not isinstance(amount, int) or not -100 <= amount <= 100:
                raise ValueError("Scroll amount must be an integer from -100 to 100")
            portal.notify("NotifyPointerAxisDiscrete", "(oa{sv}ui)", (0, -amount), 2)
        elif op == "press":
            portal.key(a["key"], True)
            portal.key(a["key"], False)
        elif op == "hotkey":
            keys = a["keys"]
            if not keys or len(keys) > 8:
                raise ValueError("Hotkey needs 1 to 8 keys")
            held = []
            try:
                for key in keys:
                    portal.key(key, True)
                    held.append(key)
            finally:
                for key in reversed(held):
                    portal.key(key, False)
        elif op == "type":
            value = a["text"]
            if not value.isascii() or len(value) > 256 or any(ord(char) < 32 and char not in "\n\r\t" for char in value):
                raise ValueError("Wayland typing needs ASCII chunks of at most 256 characters")
            for character in value:
                portal.key(character, True)
                portal.key(character, False)
        else:
            raise ValueError("Unsupported desktop operation")
        return {"operation": op, "completed": True}

    def close(self):
        if self.portal is not None:
            self.portal.stop()


def serve(backend):
    try:
        for line in sys.stdin:
            if len(line) > 4 * 1024 * 1024:
                break
            message = {}
            try:
                message = json.loads(line)
                if message["kind"] != "desktop":
                    raise ValueError("Only local desktop operations are supported")
                result = backend.desktop(message)
                response = {"id": message["id"], "result": result}
            except Exception as error:
                # Exception details can include typed input and
                # paths; return the class plus a safe, actionable generic error.
                detail = str(error) if isinstance(error, (ValueError, ModuleNotFoundError)) else "Local UI action failed. Check optional dependencies, visible desktop/OS permissions, and desktop state."
                response = {"id": message.get("id"), "error": f"{type(error).__name__}: {detail}"}
            print(json.dumps(response), flush=True)
    finally:
        backend.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state")
    parser.add_argument("--doctor", action="store_true")
    args = parser.parse_args()
    if args.doctor:
        print(json.dumps(doctor()))
        return
    serve(Backend(args.state))


if __name__ == "__main__":
    main()
