# BC Vibe Link — plan

A Bondage Club add-on that drives your real toy (e.g. Lovense Hush 2) from the vibrators your
character wears, through Intiface Central / buttplug.io. It starts as a smoother version of WCE's
toy sync, then adds advanced programs (patterns, fine strength, live control) that other players
with the add-on can run on you. Everyone else keeps seeing and using the normal five game levels.

Standalone, like Little Black Book and Quick Actions: own folder, own Tampermonkey loader, no
dependency on either.

## Status (0.11.0)

**Built:** phase 1 in full; game modes played as patterns (phase 2's mode rendering, done as one
pattern per mode); phase 3 in full (consent, live slider with replay smoothing, levels, modes,
patterns, programs, saved patterns, the worn vibrator following along, heartbeat, Play on my
toys); from phase 4, the history of who ran what (with recordings of live sessions) and
multi-motor toys as separate toys.

**Not built:** phase 2's texture, arousal link and reactions; phase 4's cross-room control by beep,
a drawn pattern editor, sharing patterns between players, and non-vibrating motors.

---

## How the game's vibrators work (R133, `VibratorMode.js`)

- Each vibrating item has `Property.Mode` and `Property.Intensity`.
- Intensity is always one of `-1` (off), `0` (low), `1` (medium), `2` (high) or `3` (max). The
  game's own validation rejects anything else (`CommonIsInteger(..., -1, 3)`), so there is no way
  to store a finer level on the item itself.
- Modes:
  - Off / Low / Medium / High / Maximum set a fixed intensity.
  - Random, Escalate, Tease, Deny and Edge are scripts that change the intensity over time.
- Those scripts run in **the wearer's** game. Every change posts an automatic chat line ("…
  increases to high") to the room and syncs the item to everyone.
- **Consequence for us:** changing the game level often spams the room. The advanced features must
  drive the toy finely but change the game level rarely.

---

## Phase 1: Core sync (the starter)

**Connection**
- Talks to Intiface Central over its local WebSocket (`ws://127.0.0.1:12345`, changeable).
- Uses a small buttplug.io client written in the add-on itself (about 200 lines of the documented
  JSON protocol: handshake, scan, device list, vibrate, stop, battery, ping). Nothing is downloaded
  from a CDN.
- Auto-reconnect, and a status indicator: not running / connected / toy found / vibrating.
- Intiface accepts one app at a time, so WCE's "Enable buttplug.io" must be off. The add-on
  detects WCE's setting and says so.

**Mapping**
- Each toy is linked to a body slot (Hush 2 → `ItemButt`). The list of slots is built from the
  vibrating items the game knows about.
- More than one toy can be linked, each to its own slot.
- The level table can be edited. Default, same as WCE:

  | Game level | Toy strength |
  |---|---|
  | Off | 0% |
  | Low | 10% |
  | Medium | 40% |
  | High | 75% |
  | Max | 100% |

**Ramping**
- When the level changes, strength slides to the new value instead of jumping.
- Separate ramp-up and ramp-down times (default 1.5 s up, 0.8 s down). 0 = instant.
- Curve: linear or ease-in/out.
- Commands go out at most every 100 ms and only when the value changes. Lovense toys have 20
  steps, so a ramp is at most 20 commands.

**Responsiveness**
- Checks your items 4 times a second (WCE: every 3 s), and also reacts straight away when the game
  updates your appearance.

**Safety, always on**
- Toys stop when the page closes, on logout, when Intiface disconnects, and when you leave the
  game tab (optional).
- 🛑 stop button plus a hotkey (e.g. Ctrl+Space) to stop everything instantly. It also pauses sync
  until you resume.
- Max-strength cap (e.g. 80%) that everything is scaled to.

**UI**
- A small floating panel: connection, toys (battery, current strength bar), slot links, level
  table, ramp times, cap.
- Settings are saved in `ExtensionSettings.VibeLink`, so they follow your account.

---

## Phase 2: Local advanced features (only you, no one else needed)

Smarter local playback of what the game is already doing. The game level and room chat stay
exactly as the game makes them.

- **Mode rendering**: when a game mode script is running, the toy plays a matching curve instead
  of the raw steps:
  - **Escalate**: one continuous build from low to max.
  - **Tease**: waves that rise and fall around the current level.
  - **Random**: random-walk drift between levels instead of jumps.
  - **Edge / Deny**: follows your arousal meter, backing off as you approach orgasm (uses
    `ArousalSettings.Progress`).
- **Texture**: optional small variation (pulse or wobble) on fixed levels, so a steady "medium"
  isn't flat.
- **Arousal link**: optional extra strength from the arousal meter, e.g. level + 30% × arousal.
- **Reactions**: optional short burst when someone uses an activity on the linked zone. This only
  affects your own toy.

---

## Phase 3: Remote advanced control

### What a controller can do

| Feature | What it is |
|---|---|
| **Fine strength** | Any value 0–100% (sent as a number; the toy rounds to its own steps) |
| **Live slider** | Drag in real time; the wearer's toy follows within about 0.3 s |
| **Patterns** | Wave, pulse, heartbeat, staircase, random, ramp-and-hold, each with min/max/speed |
| **Programs** | A sequence of steps (pattern + time) run as a timeline, optionally looping |
| **Timer** | Run for N minutes, then return to whatever the game item says |
| **Saved patterns** | Controllers save and name their own; wearers can save ones they like |

### How a controller uses it
- A controller is anyone in the room who also runs Vibe Link and whom you allow.
- When they target you (character dialog, or the Vibe Link panel's person list), a **Remote** tab
  shows each of your linked vibrator slots with:
  - Live slider, pattern picker with parameters, and timer.
  - Start / stop.
  - Your live strength shown back to them (from your add-on's status messages), so they can see
    what they're doing.
- Without Vibe Link, people just use the game's own remote as usual. That still works and is still
  smoothed (phases 1–2).

### How it maps to the five game levels
- While a remote program runs, your add-on sets the game item to a **fixed** level matching the
  program's average strength:

  | Average strength | Game level |
  |---|---|
  | 0–5% | Off |
  | 5–25% | Low |
  | 25–55% | Medium |
  | 55–85% | High |
  | 85–100% | Max |

- That level is applied once at the start. It's then changed only if the average moves to another
  level for more than about 10 s, and never more than once every 10 s. The room sees an ordinary
  vibrator at a sensible level, with no chat spam.
- Setting a fixed level also stops the game's mode scripts from fighting the program.
- The real toy plays the full program through buttplug.io.
- When the program ends, is stopped, or hits its timer, the item goes back to the mode it had
  before.
- If someone changes the item with the normal game remote during a program, the program ends and
  the game's choice wins. The game stays the source of truth.

### Messaging
- Hidden room messages (`Type: "Hidden"`, `Content: "VibeLink"`, the same channel BCX and WCE use)
  sent only to the target:
  - `hello`: on join; announces version and which slots are linked, so controllers know who can
    receive remote control.
  - `program`: a pattern or timeline as **data**, never code: `{slot, steps:[{type:"wave", min,
    max, period, duration}], loop, timer}`.
  - `live`: slider value with a sequence number, max 4 per second.
  - `stop`.
  - `status`: wearer → controller, about once a second: current strength, active program, who's
    controlling.
  - `deny`: with a reason.
- Every received value is checked and clamped (ranges, lengths, step count, total time). Anything
  invalid is dropped.

### Permissions (wearer decides) — built in v0.3.0 (step 1)
- **Who may control:**
  - Nobody, which is the default.
  - Owner, lovers, friends, a whitelist, or anyone the game allows to use items on you.
  - In every case, they must also be allowed by the game to use items on you, and the item must be
    one they could change in game.
- **Ask first (optional):** the first time someone starts something, you get an Accept / Decline /
  Always allow prompt.
- **Require a remote (optional):** like the game, the controller must have a vibrator remote in
  their inventory.
- **Locked control:** if the item is locked by someone, only the lock holder (or your owner) can
  run programs. This matches how the game treats locked items.
- **Your limits always apply:** controller values (0-100%) are **scaled** by your max strength, never clipped to it: 100% from a controller is your max, 50% is half of it. 🛑 and the hotkey always stop everything
  and refuse remote control for 5 minutes (changeable). A safe word in chat can do the same.
- **On screen:** you always see who is controlling and what is running.

---

## Phase 4: Later ideas

- **Cross-room control** by beep, for friends. It's slower, and the beep shows in their game's
  beep list, so it needs care.
- A pattern editor with a drawn curve.
- Sharing patterns between players.
- Support for toys with other motors (rotate, oscillate, constrict) where buttplug.io reports
  them. The Hush 2 only has vibrate.
- A session log of who ran what on you, stored locally.

---
