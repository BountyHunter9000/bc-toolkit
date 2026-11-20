# BC Toolkit

Small, consent-first add-ons for [Bondage Club](https://www.bondageprojects.com/), sharing one dock
on the edge of the screen. Install them all with **one script**, BC Toolkit, and turn off any you don't want in
the dock.

**[Install BC Toolkit](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-toolkit.user.js)** (all add-ons,
one script; see [Installing](#installing))

| Add-on | What it does | Only this one |
|---|---|---|
| 📓 [Little Black Book](bc-little-black-book/README.md) | Profiles of people you meet (even when they're offline), beep and whisper chats, room logs, saved outfits, online alerts. `/book` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-little-black-book/little-black-book.user.js) |
| ⚡ [Quick Actions](bc-quick-actions/README.md) | Favourite and recent activities one click away, on yourself or anyone in the room | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-quick-actions/quick-actions.user.js) |
| 〰 [Vibe Link](bc-vibe-link/README.md) | Real toys follow the vibrators your character wears, through Intiface Central, with smooth ramps, patterns and remote control | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-vibe-link/vibe-link.user.js) |
| ✨ [Afterglow](bc-afterglow/README.md) | Counts your orgasms, ruined orgasms, resists, denials and edges, the time since your last orgasm, and your records; share them with people your game permissions allow. `/afterglow` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-afterglow/afterglow.user.js) |
| 🔔 [Quiet](bc-quiet/README.md) | Mute or unmute every game notification in one tab with a click on the dock; it stays muted until you turn it back on. `/quiet` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-quiet/quiet.user.js) |
| 🎚 [Held Remote](bc-held-remote/README.md) | A Vibe Remote someone else left in your hand works on your own vibrators while your arms are tied, still within your owner's and BCX's remote rules. Off until you switch it on. `/heldremote` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-held-remote/held-remote.user.js) |
| 🔧 [Vibe Fix](bc-vibe-fix/README.md) | Stopgap for an R134 bug where vibrators never turn down: Off and lower levels (and Escalate starting over) set the intensity you picked again. No settings. | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-vibe-fix/vibe-fix.user.js) |

The [dock](bc-dock/README.md) comes with BC Toolkit (and with each separate script): a rail of tabs with
themes, opacity and position settings (its ⚙ tab). It also puts the character's name in the browser tab
("Sky · Bondage Club"), so your game tabs are easy to tell apart.

## Installing

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome or Edge.
2. Install **[BC Toolkit](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-toolkit.user.js)** and confirm
   in Tampermonkey.
3. Reload the game. Every add-on starts at its latest release; switch off the ones you don't want in the dock's
   ⚙ → **Add-ons**.

Each add-on has a menu: **Off**, **Latest** (moves to new releases each time the game loads), or a fixed version
to stay on. Changes apply right away, without reloading the game. Your choices are kept in this browser. See
[the dock's README](bc-dock/README.md#one-script-for-all-add-ons) for more.

**Or one script per add-on:** if you'd rather install only some, use the links in the table's last column. Those update through
Tampermonkey. Don't mix the two for the same add-on: if an add-on's own script is installed, BC Toolkit leaves
that add-on to it (its menu says so); turn the separate script off in Tampermonkey to choose its version in the
dock instead.

Either way, the add-ons work with the usual add-ons (WCE, BCX, LSCG, ...) and use [ModSDK](https://github.com/Jomshir98/bondage-club-mod-sdk) hooks only, never overwriting game
functions.

## Good to know

- **Consent.** Copying someone's outfit or restraints, and controlling someone's toy, only work with
  their OK, checked the way the game checks it (their permissions, their wardrobe setting, a
  request they accept).
- **Your data stays with you.** Little Black Book keeps what it saves (profiles, chats, room logs)
  in your own browser. A few settings can follow your account through the game's add-on storage,
  which other players can't see. Nothing goes to any other server.
- **Toys.** Vibe Link only talks to Intiface Central on your own computer. Your max strength
  applies to everything, the stop button and your safe word always work, and toys stop when the
  page closes.

## Development

The add-ons are plain JavaScript files with no build step. For working on them locally, use a
loader that `@require`s the files from disk instead of from a release:

```js
// @require      file:///C:/path/to/bc-toolkit/bc-dock/bc-dock.js
// @require      file:///C:/path/to/bc-toolkit/bc-quick-actions/quick-actions.js
```

(In `chrome://extensions` → Tampermonkey → Details, turn on **Allow access to file URLs**.) Add
`window.BCDockDev = { reload: true };` at the end of the loader to get the dock's developer tools:
`/reload` picks up edited files without reloading the game. See the [dock's README](bc-dock/README.md#reloading-the-add-ons-without-reloading-the-game).

### Releasing

Each add-on is released on its own, with a tag: `book-vX.Y.Z`, `qa-vX.Y.Z`, `vl-vX.Y.Z`, `ag-vX.Y.Z`,
`qt-vX.Y.Z`, `hr-vX.Y.Z`, `vf-vX.Y.Z`.

1. Bump the version in the add-on's `MOD_INFO` and in its `.user.js` (`@version` and the tag in
   both `@require` lines).
2. Commit, then tag that commit (`git tag qa-v0.5.2`).
3. Run `node tools/toolkit-list.mjs` to add the new version to `toolkit.json` (the list BC Toolkit's menus are
   filled from), and commit that.
4. Push the commits and the tag.

The loaders load the add-on and the dock from that tag through jsDelivr, so a release never changes
under anyone. Tampermonkey sees the new `@version` on `main` and offers the update; BC Toolkit users on
**Latest** get it the next time the game loads.

A new add-on also needs an entry in `toolkit.json` (id, name, icon, file path, the name of its `window` object, tag
prefix). A change to the dock is released with BC Toolkit itself: bump `@version` and the `@require` tag in
`bc-toolkit.user.js` and tag that commit `tk-vX.Y.Z`. (The separate scripts get the new dock with their next
release; the newest dock on the page takes over.)

## License

[GNU GPL v3.0 or later](LICENSE). You're free to use, change and share the add-ons; if you release a
changed version, release its source under the same license.
