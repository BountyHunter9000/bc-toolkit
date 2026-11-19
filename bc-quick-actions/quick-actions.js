// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// Quick Actions for Bondage Club
// A small floating bar in chat rooms: pick a target, then fire favourite or recent activities
// with one click (or Alt+1..9) instead of going through the character dialog each time.
(async () => {
	"use strict";

	const MOD_INFO = { name: "QuickActions", fullName: "Quick Actions", version: "0.5.2" };
	const TAG = "[QuickActions]";
	const SETTINGS_KEY = "QuickActions";
	const MAX_RECENT = 10;
	const MAX_FAVS_PER_SIDE = 30; // separately for "on myself" and "on others"

	// Re-running the script (dev reload) replaces the previous instance
	if (window.QuickActions && typeof window.QuickActions.unload === "function") window.QuickActions.unload();

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	while (typeof bcModSdk === "undefined" || typeof ServerSocket === "undefined" || typeof Player === "undefined" || typeof ActivityRun === "undefined")
		await sleep(250);

	const mod = bcModSdk.registerMod(MOD_INFO);

	// ---------- settings (saved to the account through ExtensionSettings, so they follow you across devices) ----------

	// An action is { activity, group, item?, self } — item is the asset name for item activities (e.g. MoanGag with a gag)
	// (older versions also saved pos/size/collapsed/dock here; the shared dock handles those now)
	// cooldownSec: the least time between two runs of the same action on the same person (anti-spam, set in the panel's ⚙)
	const DEFAULTS = () => ({ favorites: [], recent: [], cooldownSec: 1.5 });
	let settings = DEFAULTS();
	const COOLDOWN_CHOICES = [0.5, 1, 1.5, 2, 3, 5, 10];

	// Always starts from the defaults: settings belong to one account, and logging in as another in the same tab
	// mustn't carry the previous account's favorites over (and save them into this one)
	function loadSettings() {
		clearTimeout(saveTimer); // a save still pending for the previous account
		settings = DEFAULTS();
		try {
			const raw = Player.ExtensionSettings?.[SETTINGS_KEY];
			if (typeof raw === "string" && raw) settings = { ...settings, ...JSON.parse(LZString.decompressFromUTF16(raw)) };
		} catch (e) {
			console.warn(TAG, "settings load failed", e);
		}
	}

	let saveTimer = null;
	function saveSettings() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			if (!Player.ExtensionSettings) return;
			Player.ExtensionSettings[SETTINGS_KEY] = LZString.compressToUTF16(JSON.stringify(settings));
			ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
		}, 1000);
	}

	const sameAction = (a, b) => a.activity === b.activity && a.group === b.group && (a.item || "") === (b.item || "") && !!a.self === !!b.self;

	// ---------- game helpers ----------

	function activityLabel(name) {
		let txt = "";
		try {
			txt = ActivityDictionaryText(`Activity${name}`);
		} catch {}
		if (txt && !txt.startsWith("MISSING")) return txt;
		// Add-on activities (LSCG_Nuzzle, ...) often lack dictionary text; make the internal name readable
		return name.replace(/^[A-Za-z]+_/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
	}

	function groupLabel(target, group) {
		try {
			const g = AssetGroupGet(target?.AssetFamily || "Female3DCG", group);
			if (g?.Description) return g.Description;
		} catch {}
		return group.replace(/^Item/, "");
	}

	function actionLabel(a, target) {
		return `${activityLabel(a.activity)} · ${groupLabel(target, a.group)}`;
	}

	function roomCharacters() {
		return CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter) ? ChatRoomCharacter : [];
	}

	// Mirrors what the character dialog offers right now: permission, distance, restraints, gags...
	function findAllowed(target, action) {
		if (!target) return { error: "No target selected." };
		if (!target.IsPlayer() && !ServerChatRoomGetAllowItem(Player, target)) return { error: `${target.Name} doesn't allow you to interact.` };
		const group = AssetGroupGet(target.AssetFamily, action.group);
		if (!group) return { error: "Unknown body zone." };
		const options = ActivityAllowedForGroup(target, action.group);
		const match = options.find(
			(o) => o.Activity?.Name === action.activity && !o.Blocked && (!action.item || o.Item?.Asset?.Name === action.item)
		);
		return match ? { group, itemActivity: match } : { error: `${activityLabel(action.activity)} isn't possible on ${target.Name} right now.` };
	}

	// When each action last ran on each person, so a favorite can't be fired faster than the cooldown
	const lastRun = new Map();
	function runAction(action, target) {
		const key = `${target?.MemberNumber}|${action.activity}|${action.group}|${action.item || ""}`;
		const wait = Math.max(0.5, Number(settings.cooldownSec) || 1.5) * 1000 - (Date.now() - (lastRun.get(key) || 0));
		if (wait > 0) return ui.toast(`Wait ${Math.ceil(wait / 100) / 10} s before doing that again.`);
		const res = findAllowed(target, action);
		if (res.error) return ui.toast(res.error);
		lastRun.set(key, Date.now());
		// Same call the dialog makes when you click an activity
		ActivityRun(Player, target, res.group, res.itemActivity);
	}

	// Record activities done through the normal dialog too, so they show up under Recent
	mod.hookFunction("ActivityRun", 0, (args, next) => {
		try {
			const [actor, acted, group, itemActivity] = args;
			if (actor?.IsPlayer?.() && acted && group?.Name && itemActivity?.Activity?.Name) {
				const action = { activity: itemActivity.Activity.Name, group: group.Name, self: !!acted.IsPlayer() };
				if (itemActivity.Item?.Asset?.Name) action.item = itemActivity.Item.Asset.Name;
				settings.recent = [action, ...settings.recent.filter((a) => !sameAction(a, action))].slice(0, MAX_RECENT);
				saveSettings();
				ui.refreshSoon();
			}
		} catch (e) {
			console.warn(TAG, "recent capture failed", e);
		}
		return next(args);
	});

	// ---------- UI ----------

	const h = (tag, attrs = {}, ...children) => {
		const el = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs)) {
			if (v == null || v === false) continue;
			if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
			else if (k === "class") el.className = v;
			else el.setAttribute(k, v === true ? "" : v);
		}
		for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
		return el;
	};

	// The frame (header, open/close, position, width) is the shared dock from bc-dock.js; this styles our content.
	const CSS = `
#qa-body{display:flex;flex-direction:column;gap:3px;padding-top:2px}
#qa-body button.off{opacity:.4}
#qa-body button.sel{background:var(--bcd-line,#6b4f85);border-color:var(--bcd-hi,#9a7bb8)}
#qa-body select{width:100%;min-width:0}
.qa-col{display:flex;flex-direction:column;gap:3px}
.qa-head{color:var(--bcd-muted,#a99fc0);font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin:5px 0 0}
.qa-head:first-child{margin-top:0}
.qa-lbl{color:#999;font-size:11px}
.qa-opts{margin-top:6px;padding-top:4px;border-top:1px solid var(--bcd-line-soft,#3a2e47);display:flex;flex-direction:column;gap:4px}
.bcd-ico.sel{color:var(--bcd-accent,#c9a8ff)}
#qa-body .qa-wide{width:100%;text-align:left}
.qa-act{position:relative;display:flex;align-items:center;width:100%;text-align:left;min-width:0}
.qa-act .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qa-act .k{color:var(--bcd-accent,#c9a8ff);font-size:10px;margin-right:5px;flex:none}
.qa-act[draggable]{cursor:grab}
.qa-act.drop{outline:2px dashed var(--bcd-accent,#c9a8ff);outline-offset:1px}
.qa-act .x{margin-left:6px;color:#aaa;flex:none}
.qa-act .x:hover{color:#fff}
#qa-toast{position:fixed;z-index:10003;left:50%;bottom:70px;transform:translateX(-50%);background:#3b2033;color:#fff;border:1px solid #a0507a;
	border-radius:6px;padding:6px 12px;font:13px system-ui,sans-serif;pointer-events:none;transition:opacity .3s}
`;

	const ui = (() => {
		let panel = null; // our panel in the shared dock
		let bar = null; // the panel's body element
		let inRoom = false;
		let target = null; // Character
		let pickerOpen = false;
		let pickerGroup = "";
		let lastSig = "";
		let refreshTimer = null;
		let toastEl = null;
		let toastTimer = null;
		let dragging = null; // index into settings.favorites while a favorite is being dragged
		let optsOpen = false; // the ⚙ settings block

		function toast(msg) {
			if (!toastEl) {
				toastEl = h("div", { id: "qa-toast" });
				document.body.append(toastEl);
			}
			toastEl.textContent = msg;
			toastEl.style.opacity = "1";
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => (toastEl.style.opacity = "0"), 2500);
		}

		function mount() {
			document.head.append(h("style", { id: "qa-style" }, CSS));
			if (!window.BCDock) return console.warn(TAG, "bc-dock.js isn't loaded (add its @require to the loader), so there's no bar");
			panel = BCDock.add({ id: "quick-actions", title: "Quick Actions", icon: "⚡", order: 20, version: MOD_INFO.version, width: 190, minWidth: 150, maxWidth: 240, alignStart: true, open: true, visible: false, onToggle: () => render() });
			bar = panel.body;
			bar.id = "qa-body";
		}

		function unmount() {
			document.getElementById("qa-style")?.remove();
			panel?.remove();
			toastEl?.remove();
			panel = bar = null;
		}

		function applyScale() {
			if (bar) bar.style.fontSize = `${Math.round(13 * (settings.scale || 1))}px`;
		}

		function setScale(delta) {
			settings.scale = Math.min(1.6, Math.max(0.7, Math.round(((settings.scale || 1) + delta) * 10) / 10));
			applyScale();
			saveSettings();
		}

		const signature = () => [roomCharacters().map((c) => c.MemberNumber).join(","), target?.MemberNumber, panel?.isOpen(), pickerOpen].join("|");

		// Called on a timer: show/hide with the chat room, follow the character you click, re-render on changes
		function tick() {
			if (!panel) return;
			inRoom = CurrentScreen === "ChatRoom" && !!Player.MemberNumber;
			panel.setVisible(inRoom);
			if (!inRoom) return;
			const chars = roomCharacters();
			// Opening someone's dialog makes them the target
			if (CurrentCharacter && chars.includes(CurrentCharacter)) target = CurrentCharacter;
			if (!target || !chars.includes(target)) target = chars.find((c) => c.MemberNumber === target?.MemberNumber) || Player;
			if (signature() !== lastSig) render();
		}

		function refreshSoon() {
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => {
				// Re-rendering would close a dropdown the user is in the middle of using
				if (!bar || dragging != null || (bar.contains(document.activeElement) && document.activeElement.tagName === "SELECT")) return;
				render();
			}, 50);
		}

		function render() {
			if (!panel) return;
			lastSig = signature();
			panel.setSummary(target ? `→ ${target.IsPlayer() ? "you" : typeof CharacterNickname === "function" ? CharacterNickname(target) : target.Name}` : "");
			panel.actions.replaceChildren(
				h("button", { class: "bcd-ico", title: "Smaller text", onclick: () => setScale(-0.1) }, "A−"),
				h("button", { class: "bcd-ico", title: "Larger text", onclick: () => setScale(0.1) }, "A+"),
				h("button", { class: `bcd-ico${optsOpen ? " sel" : ""}`, title: "Quick Actions settings", onclick: () => ((optsOpen = !optsOpen), render()) }, "⚙")
			);
			applyScale();
			if (!panel.isOpen()) return bar.replaceChildren();
			const chars = roomCharacters();

			const isSelf = !!target?.IsPlayer();
			const favs = settings.favorites.filter((a) => !!a.self === isSelf);
			const recent = settings.recent.filter((a) => !!a.self === isSelf && !settings.favorites.some((f) => sameAction(f, a)));

			// One narrow column: target dropdown, then the actions one per line, so it covers as little of the room as possible
			const nameOf = (c) => (c.IsPlayer() ? "Me" : typeof CharacterNickname === "function" ? CharacterNickname(c) : c.Name);
			bar.replaceChildren(...[
				h("div", { class: "qa-head" }, "Target"),
				h(
					"select",
					{
						title: "Who the actions are done to (clicking a character in the room also picks them)",
						onchange: (e) => {
							target = chars.find((c) => String(c.MemberNumber) === e.target.value) || Player;
							e.target.blur();
							render();
						},
					},
					chars.map((c) => h("option", { value: String(c.MemberNumber), selected: c === target }, nameOf(c)))
				),
				h("div", { class: "qa-head" }, "Favorites"),
				h("div", { class: "qa-col" }, favs.length ? favs.map((a) => actionButton(a, settings.favorites.indexOf(a), true)) : h("span", { class: "qa-lbl" }, "Pin actions with ☆")),
				recent.length ? h("div", { class: "qa-head" }, "Recent") : null,
				recent.length ? h("div", { class: "qa-col" }, recent.map((a) => actionButton(a, -1, false))) : null,
				h("button", { class: "qa-wide", style: "margin-top:5px", onclick: () => ((pickerOpen = !pickerOpen), render()) }, pickerOpen ? "Close picker" : "+ Find an action"),
				pickerOpen ? renderPicker() : null,
				optsOpen ? renderOpts() : null
			].filter(Boolean));
		}

		function actionButton(a, favIndex, isFav) {
			const res = findAllowed(target, a);
			const hotkey = isFav ? favHotkey(a) : 0;
			const dragHandlers = isFav
				? {
						draggable: "true",
						ondragstart: (e) => {
							dragging = favIndex;
							e.dataTransfer.effectAllowed = "move";
							e.dataTransfer.setData("text/plain", String(favIndex));
						},
						ondragend: () => (dragging = null),
						ondragover: (e) => {
							if (dragging == null || dragging === favIndex) return;
							e.preventDefault();
							e.currentTarget.classList.add("drop");
						},
						ondragleave: (e) => e.currentTarget.classList.remove("drop"),
						ondrop: (e) => {
							e.preventDefault();
							moveFavorite(dragging, favIndex);
							dragging = null;
						},
					}
				: {};
			return h(
				"button",
				{
					...dragHandlers,
					// Not `disabled`: a disabled button swallows clicks on its unpin ×
					class: `qa-act${res.error ? " off" : ""}`,
					title: res.error || `${actionLabel(a, target)}${a.item ? ` (with ${a.item})` : ""}`,
					onclick: (e) => {
						if (e.target.classList.contains("x")) return;
						if (res.error) return toast(res.error);
						runAction(a, target);
						refreshSoon();
					},
				},
				hotkey ? h("span", { class: "k" }, `${hotkey}`) : null,
				h("span", { class: "t" }, actionLabel(a, target)),
				isFav
					? h("span", { class: "x", title: "Unpin", onclick: () => unpin(favIndex) }, "×")
					: h("span", { class: "x", title: "Pin to favorites", onclick: () => pin(a) }, "☆")
			);
		}

		// Alt+1..9 fire the favorites visible for the current target, in order
		function favHotkey(a) {
			const isSelf = !!target?.IsPlayer();
			const i = settings.favorites.filter((f) => !!f.self === isSelf).indexOf(a);
			return i >= 0 && i < 9 ? i + 1 : 0;
		}

		function pin(a) {
			if (settings.favorites.some((f) => sameAction(f, a))) return;
			if (settings.favorites.filter((f) => !!f.self === !!a.self).length >= MAX_FAVS_PER_SIDE)
				return toast(`Up to ${MAX_FAVS_PER_SIDE} favorites ${a.self ? "on yourself" : "on others"}.`);
			settings.favorites.push({ ...a });
			saveSettings();
			render();
		}

		// Hotkeys follow list order, so dragging a favorite onto another one re-assigns Alt+#
		function moveFavorite(from, to) {
			if (from == null || from === to || !settings.favorites[from] || !settings.favorites[to]) return;
			const [item] = settings.favorites.splice(from, 1);
			settings.favorites.splice(to, 0, item);
			saveSettings();
			render();
		}

		function unpin(i) {
			settings.favorites.splice(i, 1);
			saveSettings();
			render();
		}

		// Small settings block under the actions (⚙ in the header)
		function renderOpts() {
			const cur = Number(settings.cooldownSec) || 1.5;
			return h(
				"div",
				{ class: "qa-opts" },
				h("div", { class: "qa-head" }, "Settings"),
				h(
					"label",
					{ class: "qa-lbl", title: "The least time between two runs of the same action on the same person, so it can't be used to spam anyone" },
					"Repeat cooldown ",
					h(
						"select",
						{
							style: "width:auto",
							onchange: (e) => {
								settings.cooldownSec = Number(e.target.value);
								saveSettings();
								e.target.blur();
							},
						},
						COOLDOWN_CHOICES.map((v) => h("option", { value: v, selected: v === cur }, `${v} s`))
					)
				),
				h("div", { class: "qa-lbl" }, "Holding Alt+number doesn't repeat.")
			);
		}

		function renderPicker() {
			const t = target;
			if (!t) return null;
			if (!t.IsPlayer() && !ServerChatRoomGetAllowItem(Player, t)) return h("div", { class: "qa-lbl" }, `${t.Name} doesn't allow you to interact.`);
			const groups = AssetGroup.filter((g) => g.Category === "Item" && g.Family === t.AssetFamily);
			const available = groups.map((g) => [g, ActivityAllowedForGroup(t, g.Name).filter((o) => !o.Blocked)]).filter(([, list]) => list.length);
			if (!available.length) return h("div", { class: "qa-lbl" }, "No activities possible right now.");
			if (!available.some(([g]) => g.Name === pickerGroup)) pickerGroup = available[0][0].Name;
			const select = h(
				"select",
				{ onchange: (e) => ((pickerGroup = e.target.value), render()) },
				available.map(([g, list]) => h("option", { value: g.Name, selected: g.Name === pickerGroup }, `${g.Description || g.Name} (${list.length})`))
			);
			const list = available.find(([g]) => g.Name === pickerGroup)[1];
			return h(
				"div",
				{ id: "qa-pick", class: "qa-col" },
				select,
				list.map((o) => {
					const a = { activity: o.Activity.Name, group: pickerGroup, self: !!t.IsPlayer() };
					if (o.Item?.Asset?.Name) a.item = o.Item.Asset.Name;
					const pinned = settings.favorites.some((f) => sameAction(f, a));
					return h(
						"button",
						{
							class: "qa-act",
							title: o.Item?.Asset ? `with ${o.Item.Asset.Description}` : "",
							onclick: (e) => {
								if (e.target.classList.contains("x")) return;
								runAction(a, t);
							},
						},
						h("span", { class: "t" }, activityLabel(a.activity)),
						h("span", { class: "x", title: pinned ? "Pinned" : "Pin to favorites", onclick: () => pin(a) }, pinned ? "★" : "☆")
					);
				})
			);
		}

		function onKey(e) {
			if (!panel || !inRoom || !e.altKey || e.ctrlKey || e.metaKey) return;
			const n = parseInt(e.key, 10);
			if (!(n >= 1 && n <= 9)) return;
			// Holding the key down auto-repeats it; only a fresh press counts
			if (e.repeat) return e.preventDefault();
			const isSelf = !!target?.IsPlayer();
			const a = settings.favorites.filter((f) => !!f.self === isSelf)[n - 1];
			if (!a) return;
			e.preventDefault();
			runAction(a, target);
			refreshSoon();
		}

		return { mount, unmount, tick, render, refreshSoon, toast, onKey };
	})();

	// ---------- wiring ----------

	ui.mount();
	let settingsLoadedFor = null;
	const tickTimer = setInterval(() => {
		// Settings live on the account, so (re)load them whenever a different account logs in
		if (Player.MemberNumber && settingsLoadedFor !== Player.MemberNumber) {
			settingsLoadedFor = Player.MemberNumber;
			loadSettings();
		}
		ui.tick();
	}, 400);
	// Restrictions change as items go on and off; re-check which buttons are possible
	const refreshTimer = setInterval(() => ui.refreshSoon(), 3000);
	window.addEventListener("keydown", ui.onKey, true);

	window.QuickActions = {
		version: MOD_INFO.version,
		settings: () => settings,
		run: (action, target = Player) => runAction(action, target),
		unload() {
			clearInterval(tickTimer);
			clearInterval(refreshTimer);
			window.removeEventListener("keydown", ui.onKey, true);
			ui.unmount();
			mod.unload();
			delete window.QuickActions;
		},
	};

	console.log(TAG, `v${MOD_INFO.version} loaded`);
})();
