# Afterglow

*Part of [BC Toolkit](../README.md).*

A small Bondage Club add-on that keeps count of your orgasms and what stood in their way: the time since
your last one, your records, and how often you were denied, ruined or held back in between. Open it from
the **✨** tab on the shared dock's rail ([BC Dock](../bc-dock/README.md)) or with `/afterglow`. The
tab's summary shows the time since your last orgasm, or whichever clock you pick.

## What it shows

- **The time since your last orgasm**: the big clock, with when it was.
- **Three small boxes** below it: ⛔ denied, 💔 ruined and ✊ resisted. Each counts how many since your
  last orgasm, with the record for one stretch ("rec 7").
  - The ⛔ box covers edging too: under the denials it shows 🫠, how many times you've been edged.
  - While a denial item is on you, ⛔ turns into a timer: **Held** for how long it's been on, with the
    count underneath. With an edging item it's 🫠 **Edged** instead. 💔 does the same while a ruin item
    is on you. They go back to counts when the item comes off.
  - ✊ is always a count. Under it, 😵 is how many times (all time) you tried to resist and came anyway.
- Click the big clock or a box to show it on the dock tab's summary (it gets a highlighted border, 📌).
  The time since your last orgasm is the default.
- **🏆 Longest without**: your record stretch between two orgasms, with its dates. While the current
  stretch is longer, it says you've passed your record.
- **Counts** of orgasms, ruined, resisted, failed resists, denied and edged for this session, today and all
  time.
- **🫠 Time edged**: how long you've had an edging item on while online, for this session, today and all
  time. The all-time total can be reset on its own (**More → Reset time edged**).
- **The game's own count**: the lifetime orgasm count for your character, the number under its arousal
  meter when you zoom in on it. The game saves that number only when you leave its Preferences screen
  and with arousal updates in chat rooms, so it can lag behind or read 0; Afterglow's own counts don't
  depend on it.
- **Recent**: the latest events with their time and room, and ⏸ stretches you were away.
- `/afterglow stats` writes a one-line summary into your chat that only you see.

## What counts as what

Afterglow watches the game's own orgasm functions:

| | When |
|---|---|
| 💦 **Orgasm** | you orgasm (you didn't resist, or the resist timed out) |
| 💔 **Ruined** | an orgasm is ruined (a ruin effect, e.g. some belts and vibrators) |
| ✊ **Resisted** | you win the game's resist mini-game |
| 😵 **Resist failed** | you start the resist mini-game but its time runs out and you orgasm (also counted as an orgasm) |
| ⛔ **Denied** | full arousal is held at the edge (99%) by a denial effect instead of an orgasm |
| 🫠 **Edged** | full arousal is held at the edge (95%) by an edging effect: an item that edges, or a crafted item with the Edging property |

The game keeps asking while you're held at the edge, so one spell there counts once: it counts
again after a minute without being stopped, or once your arousal has dropped below 90% and come back.
Nothing counts if your arousal is turned off in the game's settings.

Before 0.4.0, edges were counted as denials. In Recent and Today they now show as edged, but the
all-time denied total from before then still includes them.

A **session** is your current stretch of play. It carries on through reloads, disconnects and breaks
shorter than 30 minutes; after a longer break (logged out, game closed, computer asleep) the next one
starts fresh. Time edged counts only while you're online and connected.

Afterglow only counts what happens while it's running, so the first stretch starts when you install it
and shows as **≥** (at least that long) until your first orgasm after that.

## Time away

While you're logged in and connected, Afterglow notes "still here" every minute (and every 10 minutes
with your account, for your other computers). When you come back after more than 2 minutes, logged
out, the game closed, disconnected or the computer asleep, that gap is **time away**, accurate to
about a minute. It's listed in Recent as ⏸ Away 2d 3h.

- The clocks show both kinds of time: under the big one, "1d 4h online" (or "3d 0h in all").
- **More → Clocks count** chooses which the clocks and the 🏆 record use: **all time** (the default)
  or **only time online**. Records are kept for both, so switching shows the matching one.
- Time away is tracked from version 0.1.0 on; time away before that, or on a computer without
  Afterglow, can't be known (another computer without it counts as away).

**More → From before Afterglow** fills in what it couldn't see (the game keeps no history of its own):
earlier totals of each kind, added to the All column; when your last orgasm was, which starts the
current stretch there; and your longest stretch without one so far, kept as the record (marked
"entered by hand") until Afterglow sees a longer one.

## Rules and privacy

- It only watches: ModSDK hooks that let the game run first and change nothing. No game function is
  replaced.
- It never sends anything to the room or to anyone; `/afterglow stats` is a local line only you see.
- Counts, records and the current stretch are saved in your account's `ExtensionSettings.Afterglow`, so
  they follow you to other computers. The recent list is kept in this browser's `localStorage`
  (`Afterglow.log.<member number>`, the last 1000 events), and so is the current session
  (`Afterglow.session.<member number>`).
- **More → Reset everything** starts over from zero (it asks first).

## Console

`Afterglow.state()`, `Afterglow.session()`, `Afterglow.log()`, `Afterglow.stats()`.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome or Edge.
2. Open **[afterglow.user.js](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-afterglow/afterglow.user.js)** and press **Install**.
3. Reload the game.

Tampermonkey checks for updates on its own. To work on the code itself, see
[Development](../README.md#development).
