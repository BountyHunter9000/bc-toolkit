# Quiet

*Part of [BC Toolkit](../README.md).*

A one-click mute for Bondage Club's notifications. Click **🔔** on the shared dock's rail
([BC Dock](../bc-dock/README.md)) to mute this tab; it turns into **🔕** with a red dot. Click it again to
turn notifications back on.

## What it mutes

Everything the game notifies you about in this tab: chat messages, people joining, beeps, disconnects and
LARP turns, in every form the game uses (the popup, the count in the tab title, the favicon and the alarm
sound). Notifications already showing are cleared when you mute.

- **Only this tab.** Each game tab has its own switch, so you can mute one character and keep another on.
- **It stays muted** through reloads and the next login, until you turn it back on. The choice is kept per
  character in this browser (`localStorage`, `Quiet.<member number>`).
- **Your game settings don't change.** Whatever you picked in the game's Preferences → Notifications stays as it
  is, and comes back the moment you unmute. The **Test** button there still works while muted.
- The tab's tooltip shows how many notifications were held back since you muted.
- [Little Black Book](../bc-little-black-book/README.md) (1.2.2 and later) holds back its own popups too: beeps,
  whispers and online alerts. Notifications that other add-ons make by themselves, without going through the
  game's, aren't covered.

## /quiet

`/quiet` switches, `/quiet on` mutes and `/quiet off` turns notifications back on. It works without the dock too.

## Rules and privacy

- One ModSDK hook on `NotificationRaise`: while muted, the game's notification isn't passed on. No game
  function is replaced and nothing is sent anywhere.

## Console

`Quiet.isMuted()`, `Quiet.mute()`, `Quiet.unmute()`, `Quiet.toggle()`.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome or Edge.
2. Open **[quiet.user.js](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-quiet/quiet.user.js)** and press **Install**.
3. Reload the game.

Tampermonkey checks for updates on its own. To work on the code itself, see
[Development](../README.md#development).
