# Dock

*Part of [BC Toolkit](../README.md). Not installed on its own: every add-on's loader brings it along.*

A small shared frame that Little Black Book, Quick Actions, Vibe Link, Afterglow and Quiet put their panels and buttons in, so they
stop floating separately and overlapping the game. It's only the frame: each add-on keeps its own
settings, storage and logic.

## How it fits together

- `bc-dock.js` is loaded by each add-on's Tampermonkey loader (`@require`) **before** the add-on
  itself. Whichever add-on loads first creates the dock (`window.BCDock`); the others find it and add
  their panel. Each add-on still works on its own: with only Vibe Link installed you get a dock with
  one panel.
- If two different versions are loaded, the newer one takes over and keeps the panels already added.
  For development all three loaders point at the same file (`bc/bc-dock/bc-dock.js`), so
  there is one copy to edit.

## What it looks like

```
▐👥²│                       tabs hang off the screen edge (left by default)
▐⚡ │┌ ⚡ Quick Actions → Robin A− A+ ✕ ┐   clicking a tab slides its panel out beside it
▐〰●│└ …                                ┘   (one panel at a time; click the tab again to close)
▐⚙ │                                        ⚙ = dock settings
```

- **📓** opens Little Black Book's own big window, as its bubble used to. Its badge is the unread count.
- **🔔** is Quiet's button: one click mutes the game's notifications in that tab (🔕), another turns them back on.
- **⚡ / 〰 / ✨** slide out Quick Actions / Vibe Link / Afterglow. The panel header shows the title, a one-line
  summary, the add-on's own buttons (Vibe Link's 🛑) and ✕.
- Tabs show a **badge** and a **status dot** (Vibe Link: green = toy connected, yellow = waiting,
  red = stopped or can't reach Intiface).
- **Drag any tab** to slide the rail along its edge, or toward another edge (left, right, top or
  bottom) to move it there. Top and bottom suit the black bars around the game when the browser
  window is wider or taller than the game. Panels open toward the middle of the screen.
- **⚙** holds the dock's settings: **panel opacity** (30–100 %: how much of the game shows through
  open panels, including Little Black Book's window; text stays solid), edge, reset position and the
  **theme**.
- **Theme**: Amethyst (the original purple), Midnight, Rose, Forest, Ember, Graphite, Royal (navy and gold), or **🎨 Custom**
  with three color pickers: **Background**, **Accent** (borders, active tab, buttons, sliders) and
  **Glow** (charts and highlights). Every other shade is mixed from those three. Changes apply as you
  drag. A background too light for the add-ons' light text is darkened automatically. Friend
  Manager's window, Vibe Link and Quick Actions all follow the theme.
- Drag a panel's outer edge to change its width (kept per panel).
- Tabs hide when their add-on has nothing to show (Quick Actions outside chat rooms, everything when
  logged out). A panel hidden that way comes back open when its tab returns.
- Position, side, opacity, theme, widths and the open panel are kept in this browser's `localStorage`
  (`BCDock.v2`).
- Tabs stay in a fixed order: Little Black Book, Quick Actions, Vibe Link, Afterglow, Quiet.

## Reloading the add-ons without reloading the game

Developer tools are hidden unless a Tampermonkey loader turns them on. The dev loaders do it with
one line after their `@require`s (one loader is enough; the others can say the same):

```js
window.BCDockDev = { reload: true, watch: false };
```

- `reload: true` shows the **Developer** section in the dock's **⚙** panel and adds `/reload`.
- `watch: true` also allows reloading whenever a file is saved (`/reload watch` and the "on save"
  box). It's off in the dev loaders because it runs whatever lands in the folder without asking.
- Leave the line out of published loaders: there, nothing of this shows or runs.

Nothing else to install: Chrome lets the page read a folder you pick.

1. **Choose folder** and pick the `bc` folder (the folder that holds `bc-dock`, `bc-little-black-book`,
   `bc-quick-actions`, `bc-vibe-link`, `bc-afterglow`). Chrome may ask to let the site view the folder: allow it, and
   choose *Allow on every visit* if offered, so it doesn't ask again after a game reload.
2. Then, in chat:

| Command | Does |
|---|---|
| `/reload` | reloads whatever changed since it was loaded |
| `/reload all` | reloads everything |
| `/reload vibe` (`book`, `qa`, `dock`) | reloads one |
| `/reload watch` | reloads whenever you save a file (needs `watch: true`; remembered; `/reload unwatch` stops) |
| `/reload folder` | picks the folder again |

The ⚙ panel has the same as buttons (**Reload changed**, **Reload all**, **on save**).

- Results show as a 🔧 line in the chat room. A file with a syntax error is reported with its line,
  and the previous version keeps running.
- Each add-on starts fresh (Little Black Book's window closes); the dock keeps its place and reopens an
  open panel; Vibe Link keeps which slot each toy follows and gets Intiface straight back.
- Changes to the Tampermonkey loaders still need a full game reload.
- If Chrome stops allowing the folder (after a browser restart, say), `/reload` says so: press
  **Reload changed** in the ⚙ panel once to allow it again.

## Rules

The dock is only a frame for the other add-ons' panels: it sends nothing to the server or to other
players, and stores only its own position, side, opacity and panel widths in this browser. The
developer reload reads the add-on files from a folder you choose, and only when you ask.

## API

```js
const panel = BCDock.add({
	id: "vibe-link",          // unique
	title: "Vibe Link",
	icon: "〰",                // the tab on the rail, and before the title
	order: 30,                // lower = higher up
	version: "0.2.4",         // shown after the title, in the tab's tooltip and in ⚙ → Add-ons
	width: 320,               // starting width; minWidth / maxWidth limit dragging (default 220 / 70% of the window)
	alignStart: false,        // true: open level with the start of the rail rather than beside its tab
	onClick: undefined,       // tab runs this instead of opening a panel (Little Black Book)
	onToggle: (open) => {},   // the panel was opened or closed
});
panel.body                  // element to render the panel's content into
panel.actions               // element in the panel header for the add-on's own buttons
panel.setSummary(text)  panel.setBadge(textOrNumber|null)  panel.setDot("on"|"wait"|"bad"|"")
panel.setTitle(text)    panel.setVisible(bool)
panel.open()  panel.close()  panel.toggle()  panel.isOpen()
panel.remove()              // on the add-on's unload
BCDock.reset()              // rail back to the left edge at the default spot, default widths
BCDock.theme()              // the current palette: { "--bcd-accent": "#c9a8ff", ... }
```

**Theme colors** are CSS variables on the page root, for add-ons to use with a fallback, e.g.
`background:var(--bcd-ctl,#2a2633)`: `--bcd-bg` (an `r g b` triplet, use as `rgb(var(--bcd-bg) / a)`),
`--bcd-tab`, `--bcd-tab-act`, `--bcd-line`, `--bcd-line-soft`, `--bcd-hi`, `--bcd-accent`, `--bcd-glow`,
`--bcd-ctl`, `--bcd-ctl-line`, `--bcd-ctl-hover`, `--bcd-text`, `--bcd-muted`. A `bcdock:theme` event
fires on `window` when they change (Vibe Link redraws its charts on it).

Handles look the dock up by id on every call, so they keep working after a newer dock takes over.

The dock styles buttons, inputs and selects inside its panels (`#bcd-fly button` …) in one look; add-ons
style only their own content, scoped to their body.

## In each add-on

- **Little Black Book** – the 📓 tab (unread count as its badge) opens its window, which follows the
  dock's opacity. The "show in the dock" setting hides the tab.
- **Quick Actions** – the ⚡ panel: summary = "→ target", A−/A+ in the header. Chat rooms only.
- **Vibe Link** – the 〰 panel: status dot on the tab, 🛑/▶ in the header, and two views: **Toys**
  (connection, toys, quick preset load) and **⚙ Settings** (Intiface, presets, strengths, ramps,
  safety).

One panel is open at a time, so Vibe Link's 🛑 is only in its panel header; its stop hotkey
(Ctrl+Space by default) works whatever is open.
