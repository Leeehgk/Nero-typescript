import { execFileSync } from "node:child_process";
import os from "node:os";
/** Envia teclas de mídia no Windows via user32 keybd_event (PowerShell). */
export function enviarTeclaMidiaVirtualKey(vk) {
    if (os.platform() !== "win32")
        return;
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
[K]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
[K]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)
`;
    try {
        execFileSync("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 5000 });
    }
    catch {
        /* ignore */
    }
}
/** VK codes comuns */
export const VK = {
    VOLUME_MUTE: 0xad,
    VOLUME_DOWN: 0xae,
    VOLUME_UP: 0xaf,
    MEDIA_NEXT: 0xb0,
    MEDIA_PREV: 0xb1,
    MEDIA_STOP: 0xb2,
    MEDIA_PLAY_PAUSE: 0xb3,
};
