# BC Toolkit

Small, consent-first add-ons for [Bondage Club](https://www.bondageprojects.com/), sharing one dock
on the edge of the screen. Install only the ones you want: each has its own Tampermonkey script.

| Add-on | What it does | Install |
|---|---|---|
| 📓 [Little Black Book](bc-little-black-book/README.md) | Profiles of people you meet (even when they're offline), beep and whisper chats, room logs, saved outfits, online alerts. `/book` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-little-black-book/little-black-book.user.js) |
| ⚡ [Quick Actions](bc-quick-actions/README.md) | Favourite and recent activities one click away, on yourself or anyone in the room | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-quick-actions/quick-actions.user.js) |
| 〰 [Vibe Link](bc-vibe-link/README.md) | Real toys follow the vibrators your character wears, through Intiface Central, with smooth ramps, patterns and remote control | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-vibe-link/vibe-link.user.js) |
| ✨ [Afterglow](bc-afterglow/README.md) | Counts your orgasms, ruined orgasms, resists, denials and edges, the time since your last orgasm, and your records; share them with people your game permissions allow. `/afterglow` | [Install](https://github.com/BountyHunter9000/bc-toolkit/raw/main/bc-afterglow/afterglow.user.js) |

The [dock](bc-dock/README.md) comes along with whichever add-on you install: a rail of tabs with
themes, opacity and position settings (its ⚙ tab).

## Installing

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome or Edge.
2. Click **Install** for an add-on in the table above, and confirm in Tampermonkey.
3. Reload the game.

Each add-on updates through Tampermonkey. They work with the usual add-ons (WCE, BCX, LSCG, ...) and
use [ModSDK](https://github.com/Jomshir98/bondage-club-mod-sdk) hooks only, never overwriting game
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

Each add-on is released on its own, with a tag: `book-vX.Y.Z`, `qa-vX.Y.Z`, `vl-vX.Y.Z`, `ag-vX.Y.Z`.

1. Bump the version in the add-on's `MOD_INFO` and in its `.user.js` (`@version` and the tag in
   both `@require` lines).
2. Commit, then tag that commit (`git tag qa-v0.5.2`) and push the commit and the tag.

The loaders load the add-on and the dock from that tag through jsDelivr, so a release never changes
under anyone. Tampermonkey sees the new `@version` on `main` and offers the update.

## License

[GNU GPL v3.0 or later](LICENSE). You're free to use, change and share the add-ons; if you release a
changed version, release its source under the same license.
