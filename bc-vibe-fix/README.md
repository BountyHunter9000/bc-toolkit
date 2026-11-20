# Vibe Fix

*Part of [BC Toolkit](../README.md).*

A stopgap for a bug in Bondage Club **R134**: a vibrator's intensity can only go up. Picking **Off**, or a lower
level, changes the mode's name, but the vibrator keeps running at the highest level it reached, so arousal keeps
building (and Vibe Link keeps your toy going at that level). **Escalate** gets stuck at Maximum the same way, instead
of starting over from Low.

| You pick | R134 shows | R134 actually runs at | With Vibe Fix |
|---|---|---|---|
| Low | Low | Low | Low |
| Off | Off | **Low** | Off |
| Medium, then Off | Off | **Medium** | Off |
| High, then Low | Low | **High** | Low |
| Escalate from Maximum | Escalate | **Maximum, forever** | Low, then up again |

It has no button or settings: install it and it works. When the game fixes the bug, Vibe Fix stops having
anything to do, and you can uninstall it.

## Why it happens

Vibrators keep a default intensity (off) in their item data. When a vibrator's mode changes, R134 leaves the old
intensity out of what it removes, because it's one of those defaults (`ExtendedItemSetOption`), then merges the old
and new intensity by keeping the larger one (the Intensity property's merge rule). So the old, higher value always
wins. Found by reproducing it in R134 with no add-ons loaded.

## How it works

- One ModSDK hook on `ExtendedItemSetProperty`. When a change sets a vibrator's intensity, the item has a different
  one, and the game has left the old one out of what it removes, the old intensity is cleared first, so the new one
  replaces it. Everything else about the change is left to the game, which also sends it to the room as usual.
- It fixes changes you make (to your own vibrators or other people's) from the moment it's installed. A vibrator
  that's already stuck is fixed the next time its mode is picked.
- Other people's vibrators changed by someone without the fix still behave as R134 does.
- Nothing is sent anywhere by the add-on itself, and no game function is replaced.

## Console

`VibeFix.fixed()`: how many intensity changes it has put right since the page loaded.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome or Edge.
2. Install **[BC Toolkit](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-toolkit.user.js)**, the one script for all the add-ons, and confirm in Tampermonkey.
3. Reload the game. Vibe Fix runs at its latest release; the dock's ⚙ → **Add-ons** turns it off or picks an
   earlier version (see [One script for all add-ons](../bc-dock/README.md#one-script-for-all-add-ons)).

**Only this add-on:** install **[vibe-fix.user.js](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-vibe-fix/vibe-fix.user.js)**
instead of BC Toolkit. If you have both, the separate script runs Vibe Fix and BC Toolkit leaves it alone.
