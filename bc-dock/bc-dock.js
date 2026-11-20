// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// BC Dock: a rail of tabs on the screen edge for Little Black Book, Quick Actions and Vibe Link.
// Clicking a tab slides its panel out beside the rail (one at a time), or runs the add-on's own
// action (Little Black Book opens its big window). The BC Toolkit script (bc-toolkit.user.js) @requires this file,
// and the dock is then also the loader: ⚙ → Add-ons picks which add-ons run and at which version. The first copy to
// run creates window.BCDock; later copies of the same or an older version leave it alone, and a newer version takes
// over, keeping the panels already added. See README.md.
(() => {
	"use strict";
	const VERSION = 14; // 3: add-on versions in the header, tooltips and ⚙; 4: per-panel minWidth/maxWidth; 5: steps aside for game popups; 6: slimmer ⚙ panel; 7: themes; 8: Royal (blue/gold); 9: says when the dev folder moved; 10: developer tools only when a loader turns them on; 11: Little Black Book; 12: Afterglow in the developer reload; 13: character name in the browser tab, title markers for add-ons, Quiet, Held Remote and Vibe Fix in the developer reload; 14: the BC Toolkit loader (⚙ → Add-ons, a version for each add-on)
	const prev = window.BCDock;
	if (prev && prev.version >= VERSION && !window.__bcDockReload) return;
	delete window.__bcDockReload;

	const STORE = "BCDock.v2";
	const DEFAULT_W = 320;
	const MIN_W = 220;
	const TAB = 44; // tab size in px

	const el = (tag, attrs = {}, ...kids) => {
		const e = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs)) {
			if (v == null || v === false) continue;
			if (k === "class") e.className = v;
			else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
			else e.setAttribute(k, v === true ? "" : v);
		}
		for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid instanceof Node ? kid : String(kid));
		return e;
	};

	// ---------- saved state (this browser only) ----------
	let state = { side: "left", y: null, x: null, opacity: 0.94, widths: {}, active: null, theme: { preset: "amethyst" } };
	try {
		const s = JSON.parse(localStorage.getItem(STORE) || "null");
		if (s && typeof s === "object") state = { ...state, ...s, widths: { ...(s.widths || {}) } };
	} catch {}
	const SIDES = ["left", "right", "top", "bottom"];
	if (!SIDES.includes(state.side)) state.side = "left";
	const horizontal = () => state.side === "top" || state.side === "bottom";
	const clampOpacity = (v) => Math.min(1, Math.max(0.3, Number(v) || 0.94));
	state.opacity = clampOpacity(state.opacity);

	// ---------- themes ----------
	// A theme is three colors: background, accent (borders, active tab, sliders) and glow (charts, highlights). Every other
	// shade the dock and the add-ons use is mixed from those, and published as CSS variables (--bcd-*) on the page root.
	const THEMES = {
		amethyst: { name: "Amethyst", bg: "#1b1622", accent: "#c9a8ff", glow: "#e070a0" },
		midnight: { name: "Midnight", bg: "#121826", accent: "#7fb2ff", glow: "#4dd0e1" },
		rose: { name: "Rose", bg: "#22161c", accent: "#ff9ec8", glow: "#ff6f91" },
		forest: { name: "Forest", bg: "#141d18", accent: "#8fd6a0", glow: "#d4e157" },
		ember: { name: "Ember", bg: "#201714", accent: "#ffb36b", glow: "#ff6b4a" },
		graphite: { name: "Graphite", bg: "#18181b", accent: "#c8c8d0", glow: "#9aa0ff" },
		royal: { name: "Royal", bg: "#101a33", accent: "#e8c15a", glow: "#4f9dff" }, // navy blue and gold
	};
	const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
	const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	const hexOf = (rgb) => "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
	const mix = (a, b, t) => hexOf(rgbOf(a).map((c, i) => c + (rgbOf(b)[i] - c) * t));
	const lum = (hex) => rgbOf(hex).reduce((s, c, i) => s + (c / 255) * [0.2126, 0.7152, 0.0722][i], 0);
	function themeColors() {
		const t = state.theme || {};
		const base = THEMES[t.preset] || THEMES.amethyst;
		const custom = t.preset === "custom";
		let bg = custom && isHex(t.bg) ? t.bg : base.bg;
		// The add-ons draw light text, so a background is kept dark enough to read on
		while (lum(bg) > 0.22) bg = mix(bg, "#000000", 0.15);
		const accent = custom && isHex(t.accent) ? t.accent : base.accent;
		const glow = custom && isHex(t.glow) ? t.glow : base.glow;
		return {
			"--bcd-bg": rgbOf(bg).join(" "),
			"--bcd-tab": mix(bg, accent, 0.1),
			"--bcd-tab-act": mix(bg, accent, 0.28),
			"--bcd-line": mix(bg, accent, 0.45),
			"--bcd-line-soft": mix(bg, accent, 0.2),
			"--bcd-hi": mix(bg, accent, 0.68),
			"--bcd-accent": accent,
			"--bcd-glow": glow,
			"--bcd-ctl": mix(mix(bg, "#ffffff", 0.05), accent, 0.06),
			"--bcd-ctl-line": mix(bg, accent, 0.3),
			"--bcd-ctl-hover": mix(bg, accent, 0.18),
			"--bcd-text": "#eeeeee",
			"--bcd-muted": mix("#d8d8d8", accent, 0.4),
		};
	}
	function applyTheme() {
		const root = document.documentElement.style;
		for (const [k, v] of Object.entries(themeColors())) root.setProperty(k, v);
		window.dispatchEvent(new CustomEvent("bcdock:theme"));
	}
	applyTheme();
	const save = () => {
		try {
			localStorage.setItem(STORE, JSON.stringify(state));
		} catch {}
	};

	// ---------- browser tab title ----------
	// "(3) Sky · Bondage Club": the character's name (nickname if set) after the game's own notification count, with
	// any markers add-ons ask for in front of it (Quiet's 🔕). The game writes the title itself (NotificationTitleUpdate,
	// as "(3) Bondage Club"); the dock watches the <title> and adds the name right after each write. Watching isn't
	// slowed in a background tab, the way timers are, and needs no hook in the game. Off: ⚙ → Character name in the tab.
	const titleMarks = new Map(prev?._titleMarks?.() || []); // add-on id -> marker text
	let titleBase = null; // the title as the game (or another mod) last wrote it, without our additions
	let titleSet = null; // the title we last wrote
	const titleOn = () => state.titleName !== false;
	function titleName() {
		try {
			if (typeof Player === "undefined" || !Player?.MemberNumber) return "";
			const n = typeof CharacterNickname === "function" ? CharacterNickname(Player) : "";
			return String(n || Player.Name || "").trim();
		} catch {
			return String(Player?.Name || "").trim();
		}
	}
	function wantTitle(base) {
		const m = /^(\(\d+\)\s*)?([\s\S]*)$/.exec(base);
		const marks = [...titleMarks.values()].filter(Boolean).join("");
		const name = titleOn() ? titleName() : "";
		return `${m[1] || ""}${marks ? `${marks} ` : ""}${name ? `${name} · ` : ""}${m[2]}`;
	}
	function applyTitle() {
		if (document.title !== titleSet) titleBase = document.title; // written by someone else since: that's the new base
		if (titleBase == null) titleBase = document.title;
		const t = wantTitle(titleBase);
		titleSet = t;
		if (document.title !== t) document.title = t;
	}
	const titleObserver = new MutationObserver(() => {
		if (document.title !== titleSet) applyTitle();
	});
	function titleStart() {
		titleObserver.observe(document.head || document.documentElement, { subtree: true, childList: true, characterData: true });
		applyTitle();
	}
	// Logging in, out or as someone else changes the name without a title write: checked every couple of seconds
	let titleWho = null;
	const titleTimer = setInterval(() => {
		const who = `${titleOn()}|${titleName()}`;
		if (who !== titleWho) (titleWho = who), applyTitle();
	}, 2000);
	function titleStop() {
		titleObserver.disconnect();
		clearInterval(titleTimer);
		if (titleBase != null && document.title === titleSet) document.title = titleBase; // hand back the game's own title
	}
	function setTitleMark(id, text) {
		if (typeof id !== "string" || !id) return;
		if (text == null || text === "") titleMarks.delete(id);
		else titleMarks.set(id, String(text).slice(0, 8));
		applyTitle();
	}

	const CSS = `
:root{--bcd-opacity:${state.opacity}}
#bcd-rail{position:fixed;z-index:10000;display:flex;flex-direction:column;gap:4px;user-select:none;touch-action:none}
#bcd-rail.left{left:0}#bcd-rail.right{right:0}#bcd-rail.top{top:0;flex-direction:row}#bcd-rail.bottom{bottom:0;flex-direction:row}
#bcd-rail.empty{display:none}
#bcd-rail,#bcd-fly{transition:opacity .2s}
.bcd-yield #bcd-rail,.bcd-yield #bcd-fly{opacity:.12;pointer-events:none}
.bcd-tab{position:relative;width:${TAB}px;height:${TAB}px;display:flex;align-items:center;justify-content:center;font:22px/1 sans-serif;cursor:pointer;
	background:var(--bcd-tab);border:2px solid var(--bcd-line);box-shadow:0 3px 10px #0008;opacity:.85;color:var(--bcd-text)}
#bcd-rail.left .bcd-tab{border-left:none;border-radius:0 12px 12px 0}
#bcd-rail.right .bcd-tab{border-right:none;border-radius:12px 0 0 12px}
#bcd-rail.top .bcd-tab{border-top:none;border-radius:0 0 12px 12px}
#bcd-rail.bottom .bcd-tab{border-bottom:none;border-radius:12px 12px 0 0}
#bcd-rail.top .bcd-tab.cfg,#bcd-rail.bottom .bcd-tab.cfg{height:${TAB}px;width:22px}
#bcd-rail.top .bcd-tab .bcd-badge{top:auto;bottom:-5px}
.bcd-tab:hover{opacity:1;border-color:var(--bcd-hi)}
.bcd-tab.act{opacity:1;border-color:var(--bcd-accent);background:var(--bcd-tab-act)}
.bcd-tab.hidden{display:none}
.bcd-tab.cfg{height:22px;font-size:13px;opacity:.55}
.bcd-tab .bcd-badge{position:absolute;top:-5px;right:-6px}
#bcd-rail.right .bcd-tab .bcd-badge{right:auto;left:-6px}
.bcd-tab .bcd-dot{position:absolute;bottom:4px;right:4px;width:9px;height:9px;border:1px solid #0008}
.bcd-badge{background:#c2185b;color:#fff;border-radius:9px;padding:0 5px;font:700 11px/16px system-ui,sans-serif}
.bcd-badge:empty{display:none}
.bcd-dot{border-radius:50%;flex:none;background:#666;width:9px;height:9px}
.bcd-dot.none{display:none}.bcd-dot.on{background:#4c4}.bcd-dot.wait{background:#db4}.bcd-dot.bad{background:#d44}
#bcd-fly{position:fixed;z-index:10000;display:flex;flex-direction:column;max-height:85vh;background:rgb(var(--bcd-bg) / var(--bcd-opacity));color:var(--bcd-text);
	border:1px solid var(--bcd-line);border-radius:8px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px #0008}
#bcd-fly.closed{display:none}
#bcd-fly.top,#bcd-fly.bottom{max-height:calc(100vh - ${TAB + 16}px)}
#bcd-fly *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:var(--bcd-line) transparent}
#bcd-fly button{font:inherit;color:var(--bcd-text);background:var(--bcd-ctl);border:1px solid var(--bcd-ctl-line);border-radius:4px;padding:2px 8px;cursor:pointer}
#bcd-fly button:hover:not(:disabled){background:var(--bcd-ctl-hover)}
#bcd-fly button:disabled{opacity:.5;cursor:default}
#bcd-fly input[type=text],#bcd-fly input[type=number],#bcd-fly select,#bcd-fly textarea{font:inherit;color:var(--bcd-text);background:var(--bcd-ctl);border:1px solid var(--bcd-ctl-line);border-radius:4px;padding:2px 4px}
#bcd-fly .bcd-ico{background:none;border:none;padding:0 4px;color:#bbb}
#bcd-fly .bcd-ico:hover:not(:disabled){background:var(--bcd-ctl-hover);color:#fff}
.bcd-head{display:flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border-bottom:1px solid var(--bcd-line-soft);flex:none;user-select:none}
.bcd-title{font-weight:600;white-space:nowrap;display:flex;gap:5px}
#bcd-fly.narrow .bcd-tt,#bcd-fly.narrow .bcd-ver{display:none}
.bcd-ver{color:var(--bcd-muted);font-size:11px;white-space:nowrap}
.bcd-ver:empty{display:none}
.bcd-cfg .bcd-vers{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11px}
.bcd-cfg .bcd-vers span:nth-child(even){color:#bbb}
.bcd-sum{flex:1;min-width:0;color:#bbb;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcd-actions{display:flex;gap:4px;align-items:center;flex:none}
.bcd-actions:empty{display:none}
.bcd-bodywrap{overflow:auto;flex:1;min-height:0}
.bcd-body{padding:6px 10px 10px}
.bcd-sizer{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}
#bcd-fly.left .bcd-sizer,#bcd-fly.top .bcd-sizer,#bcd-fly.bottom .bcd-sizer{right:-4px}#bcd-fly.right .bcd-sizer{left:-4px}
.bcd-cfg{font-size:12px}
.bcd-cfg .row{display:flex;align-items:center;gap:4px;margin:3px 0;flex-wrap:wrap}
.bcd-cfg .sides{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin:3px 0}
.bcd-cfg .sides button{padding:2px 0}
.bcd-cfg .hint{color:#999;font-size:11px}
.bcd-cfg h4{margin:8px 0 2px;font-size:10px;color:var(--bcd-muted);text-transform:uppercase;letter-spacing:.05em}
.bcd-cfg .themes{display:grid;grid-template-columns:repeat(2,1fr);gap:3px;margin:3px 0}
#bcd-fly input[type=range]{accent-color:var(--bcd-accent)}
.bcd-cfg .themes button{display:flex;align-items:center;gap:4px;padding:2px 4px;font-size:11px;overflow:hidden;white-space:nowrap}
.bcd-cfg .themes button.on{border-color:var(--bcd-accent);background:var(--bcd-tab-act)}
.bcd-cfg .sw{display:inline-flex;flex:none;border-radius:3px;overflow:hidden;border:1px solid #0006}
.bcd-cfg .sw i{width:6px;height:12px}
.bcd-cfg .tk{display:grid;grid-template-columns:1fr auto;gap:1px 6px;align-items:center;margin:3px 0}
.bcd-cfg .tk select{font-size:11px;max-width:110px;padding:1px 2px;background:var(--bcd-ctl);color:inherit;border:1px solid var(--bcd-ctl-line);border-radius:4px}
.bcd-cfg .tk .st:empty{display:none}
.bcd-cfg .tk .st{grid-column:1/-1;font-size:10px;color:#999;margin:-1px 0 3px 18px}
.bcd-cfg .tk .st.bad{color:#e88}.bcd-cfg .tk .st.ok{color:#8c8}
.bcd-cfg input[type=color]{width:34px;height:20px;padding:0 1px;border:1px solid var(--bcd-ctl-line);border-radius:4px;background:var(--bcd-ctl);cursor:pointer}
`;

	// ---------- DOM ----------
	const style = el("style", { id: "bcd-style" }, CSS);
	const rail = el("div", { id: "bcd-rail", class: "empty" });
	const flyTitle = el("span", { class: "bcd-title" });
	const flyVer = el("span", { class: "bcd-ver" });
	const flySum = el("span", { class: "bcd-sum" });
	const flyActions = el("span", { class: "bcd-actions" });
	const flyBodyWrap = el("div", { class: "bcd-bodywrap" });
	const sizer = el("div", { class: "bcd-sizer", title: "Drag to change the width" });
	const fly = el(
		"div",
		{ id: "bcd-fly", class: "closed" },
		el("div", { class: "bcd-head" }, flyTitle, flyVer, flySum, flyActions, el("button", { class: "bcd-ico", title: "Close", onclick: () => setActive(null) }, "✕")),
		flyBodyWrap,
		sizer
	);
	// Keep typing and wheel scrolling inside the dock away from the game
	for (const node of [rail, fly]) for (const ev of ["keydown", "keyup", "keypress", "wheel"]) node.addEventListener(ev, (e) => e.stopPropagation());

	/** @type {Map<string, any>} */
	const panels = new Map();
	let active = null; // id of the panel shown in the flyout

	// The dock's own settings, shown in the flyout from the small ⚙ tab
	const CFG = "__dock";
	const cfgTab = el("div", { class: "bcd-tab cfg", title: "Dock settings: opacity, side" }, "⚙");
	const cfgBody = el("div", { class: "bcd-body bcd-cfg" });
	const cfgPanel = { spec: { id: CFG, title: "Dock settings", icon: "⚙", order: 1e9, version: `v${VERSION}`, width: 230, minWidth: 200, maxWidth: 320, alignStart: true }, tab: cfgTab, body: cfgBody, actions: el("span"), sum: "", visible: true };
	attachTabEvents(cfgPanel);

	function renderCfg() {
		const pct = Math.round(state.opacity * 100);
		const out = el("span", {}, `${pct}%`);
		cfgBody.replaceChildren(
			// With the BC Toolkit loader, the add-on menus come first
			...(tkOn() ? [el("h4", { style: "margin-top:0" }, "Add-ons"), ...tkSection(), el("h4", {}, "Dock")] : []),
			el(
				"div",
				{ class: "row" },
				"Panel opacity",
				el("input", {
					type: "range",
					min: 30,
					max: 100,
					step: 5,
					value: pct,
					style: "flex:1",
					oninput: (e) => {
						setOpacity(+e.target.value / 100);
						out.textContent = `${e.target.value}%`;
					},
				}),
				out
			),
			el("div", { class: "hint" }, "How much of the game shows through panels."),
			el(
				"div",
				{ class: "row" },
				"Side",
				el("span", { style: "flex:1" }),
				el("button", { onclick: () => api.reset() }, "Reset position")
			),
			el("div", { class: "sides" }, SIDES.map((sd) => el("button", { onclick: () => setSide(sd), style: state.side === sd ? "background:var(--bcd-line)" : "" }, sd[0].toUpperCase() + sd.slice(1)))),
			el("div", { class: "hint" }, "Drag a tab to move the rail along or to another edge."),
			...themeSection(),
			el("h4", {}, "Browser tab"),
			el(
				"label",
				{ class: "row", title: "Shows who's logged in on the browser tab, e.g. \"(3) Sky · Bondage Club\", so you can tell your game tabs apart" },
				el("input", {
					type: "checkbox",
					checked: titleOn(),
					onchange: (e) => {
						state.titleName = e.target.checked;
						save();
						titleWho = null;
						applyTitle();
					},
				}),
				"Character name in the tab"
			),
			...(tkOn() ? [] : [el("h4", {}, "Add-ons")]),
			el(
				"div",
				{ class: "bcd-vers", style: tkOn() ? "display:none" : null },
				[...panels.values()].sort((a, b) => a.spec.order - b.spec.order).flatMap((p) => [el("span", {}, `${p.spec.icon ? p.spec.icon + " " : ""}${p.spec.title}`), el("span", {}, verText(p) || "version not reported")]),
				el("span", {}, "⚙ Dock"),
				el("span", {}, `v${VERSION}`)
			),
			...(devOn() ? devSection() : [])
		);
	}

	// Theme presets as swatch buttons, plus Custom with three color pickers (applied as you drag)
	function themeSection() {
		const t = state.theme || {};
		const cur = themeColors();
		const swatch = (th) => el("span", { class: "sw" }, [th.bg, th.accent, th.glow].map((c) => el("i", { style: `background:${c}` })));
		const pick = (preset) => {
			state.theme = preset === "custom" ? { preset, bg: t.bg || hexOf(cur["--bcd-bg"].split(" ").map(Number)), accent: t.accent || cur["--bcd-accent"], glow: t.glow || cur["--bcd-glow"] } : { ...t, preset };
			save();
			applyTheme();
			renderCfg();
		};
		const out = [
			el("h4", {}, "Theme"),
			el(
				"div",
				{ class: "themes" },
				Object.entries(THEMES).map(([k, th]) => el("button", { class: t.preset === k || (!THEMES[t.preset] && t.preset !== "custom" && k === "amethyst") ? "on" : "", title: th.name, onclick: () => pick(k) }, swatch(th), th.name)),
				el("button", { class: t.preset === "custom" ? "on" : "", title: "Pick your own colors", onclick: () => pick("custom") }, "🎨 Custom")
			),
		];
		if (t.preset === "custom") {
			const color = (key, label, tip) =>
				el(
					"label",
					{ class: "row", title: tip },
					el("input", {
						type: "color",
						value: isHex(t[key]) ? t[key] : key === "bg" ? hexOf(cur["--bcd-bg"].split(" ").map(Number)) : cur[`--bcd-${key}`],
						oninput: (e) => {
							state.theme = { ...state.theme, [key]: e.target.value };
							applyTheme();
						},
						onchange: () => save(),
					}),
					label
				);
			out.push(
				color("bg", "Background", "Panel and tab background (kept dark enough for light text)"),
				color("accent", "Accent", "Borders, the active tab, buttons and sliders"),
				color("glow", "Glow", "Charts and highlights"),
				el("div", { class: "hint" }, "Every other shade is mixed from these three. Add-ons that use the dock follow it.")
			);
		}
		return out;
	}

	function setOpacity(v) {
		state.opacity = clampOpacity(v);
		document.documentElement.style.setProperty("--bcd-opacity", String(state.opacity));
		save();
	}

	function setSide(side) {
		state.side = SIDES.includes(side) ? side : "left";
		save();
		place();
		if (active === CFG) renderCfg();
	}

	function makePanel(spec, adopted) {
		const p = {
			spec: { order: 50, ...spec },
			visible: adopted?.visible ?? spec.visible ?? true,
			badge: adopted?.badge ?? null,
			sum: adopted?.summary ?? "",
			dot: el("span", { class: adopted?.dotClass || "bcd-dot none" }),
			badgeEl: el("span", { class: "bcd-badge" }),
			actions: adopted?.actions || el("span", { class: "bcd-actions" }),
			body: adopted?.body || el("div", { class: "bcd-body" }),
		};
		p.icon = el("span", {});
		p.tab = el("div", { class: "bcd-tab", "data-id": spec.id }, p.icon, p.badgeEl, p.dot);
		attachTabEvents(p);
		p.setTitle = (t) => {
			p.spec.title = t;
			p.icon.textContent = p.spec.icon || t.slice(0, 2);
			updateTip(p);
			if (active === p.spec.id) setFlyTitle(p);
		};
		p.setSummary = (t) => {
			p.sum = t == null ? "" : String(t);
			updateTip(p);
			if (active === p.spec.id && flySum.textContent !== p.sum) (flySum.textContent = p.sum), (flySum.title = p.sum);
		};
		p.setBadge = (b) => {
			b = b == null || b === 0 || b === "" ? null : String(b);
			if (p.badge === b) return;
			p.badge = b;
			p.badgeEl.textContent = b || "";
		};
		p.setDot = (d) => (p.dot.className = `bcd-dot ${d || "none"}`);
		p.setVisible = (v) => {
			v = !!v;
			if (p.visible === v) return;
			p.visible = v;
			p.tab.classList.toggle("hidden", !v);
			if (!v && active === p.spec.id) {
				// Hidden by the add-on, not closed by the user: remember to reopen it
				setActive(null);
				state.active = p.spec.id;
				save();
			}
			// Coming back (e.g. Quick Actions on entering a chat room): reopen it if it was open last
			if (v && !active && state.active === p.spec.id && !p.spec.onClick) setActive(p.spec.id);
			layoutSoon();
		};
		p.tab.classList.toggle("hidden", !p.visible);
		p.badgeEl.textContent = p.badge || "";
		p.setTitle(p.spec.title || p.spec.id);
		return p;
	}

	// "0.5.2" → "v0.5.2"; anything else (e.g. "v3") as given
	const verText = (p) => {
		const v = p.spec.version == null ? "" : String(p.spec.version).trim();
		return /^\d/.test(v) ? `v${v}` : v;
	};

	// "⚡ Quick Actions": on a narrow panel only the icon shows (the title and version are in the tooltip)
	function setFlyTitle(p) {
		flyTitle.replaceChildren(p.spec.icon ? el("span", {}, p.spec.icon) : "", el("span", { class: "bcd-tt" }, p.spec.title));
		flyTitle.title = `${p.spec.title}${verText(p) ? ` ${verText(p)}` : ""}`;
	}

	function updateTip(p) {
		const v = verText(p);
		p.tab.title = `${p.spec.title}${v ? ` ${v}` : ""}${p.sum ? ` · ${p.sum}` : ""}${p.spec.onClick ? "" : "\nClick to open or close · drag to move the rail"}`;
	}

	// A press that doesn't move is a click; moving drags the whole rail (along the edge, or across to the other side)
	function attachTabEvents(p) {
		p.tab.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			const startX = e.clientX;
			const startY = e.clientY;
			const r = rail.getBoundingClientRect();
			const dy = e.clientY - r.top;
			const dx = e.clientX - r.left;
			let moved = false;
			try {
				p.tab.setPointerCapture(e.pointerId);
			} catch {}
			const move = (ev) => {
				if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
				moved = true;
				// Snap to whichever edge the pointer is nearest, sliding along it
				const d = { left: ev.clientX, right: innerWidth - ev.clientX, top: ev.clientY, bottom: innerHeight - ev.clientY };
				state.side = SIDES.reduce((a, b) => (d[b] < d[a] ? b : a));
				if (horizontal()) state.x = ev.clientX - dx;
				else state.y = ev.clientY - dy;
				place();
			};
			const up = () => {
				p.tab.removeEventListener("pointermove", move);
				p.tab.removeEventListener("pointerup", up);
				p.tab.removeEventListener("pointercancel", up);
				if (moved) {
					const rr = rail.getBoundingClientRect();
					if (horizontal()) state.x = Math.round(rr.left);
					else state.y = Math.round(rr.top);
					save();
					if (active === CFG) renderCfg();
				} else if (p.spec.onClick) {
					try {
						p.spec.onClick();
					} catch (err) {
						console.warn("[BCDock]", p.spec.id, "click failed", err);
					}
				} else setActive(active === p.spec.id ? null : p.spec.id);
			};
			p.tab.addEventListener("pointermove", move);
			p.tab.addEventListener("pointerup", up);
			p.tab.addEventListener("pointercancel", up);
		});
	}

	const panelOf = (id) => (id === CFG ? cfgPanel : panels.get(id));

	function setActive(id) {
		if (id != null && !panelOf(id)) id = null;
		if (id === active) return;
		const before = active;
		active = id;
		state.active = id === CFG ? null : id;
		save();
		const old = panelOf(before);
		old?.tab.classList.remove("act");
		if (old && old !== cfgPanel) notifyToggle(old, false);
		const p = panelOf(id);
		if (!p) {
			fly.classList.add("closed");
			flyBodyWrap.replaceChildren();
			return;
		}
		p.tab.classList.add("act");
		setFlyTitle(p);
		flyVer.textContent = verText(p);
		flySum.textContent = flySum.title = p.sum || "";
		flyBodyWrap.replaceChildren(p.body);
		swapActions(p.actions);
		fly.classList.remove("closed");
		if (p === cfgPanel) renderCfg();
		else notifyToggle(p, true);
		place();
	}

	// The header's action slot shows the active panel's own actions element
	let actionsSlot = flyActions;
	function swapActions(node) {
		if (actionsSlot === node) return;
		if (actionsSlot.isConnected) actionsSlot.replaceWith(node);
		actionsSlot = node;
		node.classList.add("bcd-actions");
	}

	function notifyToggle(p, open) {
		try {
			p.spec.onToggle?.(open);
		} catch (e) {
			console.warn("[BCDock]", p.spec.id, "onToggle failed", e);
		}
	}

	// ---------- placement ----------
	// A panel may narrow the allowed widths (Quick Actions stays a slim column)
	function clampW(p, w) {
		const min = p?.spec.minWidth ?? MIN_W;
		const max = Math.max(min, Math.min(innerWidth * 0.7, p?.spec.maxWidth ?? Infinity));
		return Math.round(Math.max(min, Math.min(max, w)));
	}

	function place() {
		// With the BC Toolkit loader, ⚙ stays reachable even before any add-on shows a tab (its menus switch them on)
		const any = [...panels.values()].some((p) => p.visible) || (tk.started && tkOn());
		rail.className = `${state.side}${any ? "" : " empty"}`;
		if (!any && active === CFG) return setActive(null);
		const rr = rail.getBoundingClientRect();
		if (horizontal()) {
			const w = rr.width || TAB;
			const x = state.x == null ? 90 : state.x;
			rail.style.left = `${Math.max(0, Math.min(innerWidth - w, x))}px`;
			rail.style.top = "";
		} else {
			const h = rr.height || TAB;
			const y = state.y == null ? innerHeight - h - 90 : state.y;
			rail.style.top = `${Math.max(0, Math.min(innerHeight - h, y))}px`;
			rail.style.left = "";
		}
		if (fly.classList.contains("closed")) return;
		const p = panelOf(active);
		const w = clampW(p, state.widths[active] || p?.spec.width || DEFAULT_W);
		fly.className = `${state.side}${w < 250 ? " narrow" : ""}`;
		fly.style.width = `${w}px`;
		const rail2 = rail.getBoundingClientRect();
		const tr = p?.tab.getBoundingClientRect();
		const fr = fly.getBoundingClientRect();
		Object.assign(fly.style, { left: "", right: "", top: "", bottom: "" });
		// Open toward the middle of the screen, lined up with its tab and kept on screen
		if (horizontal()) {
			// alignStart: line up with the start of the rail instead of the tab (stays tight to the left)
			const from = p?.spec.alignStart ? rail2.left : tr ? tr.left : 0;
			fly.style.left = `${Math.max(4, Math.min(innerWidth - fr.width - 4, from))}px`;
			if (state.side === "top") fly.style.top = `${rail2.height + 6}px`;
			else fly.style.bottom = `${rail2.height + 6}px`;
		} else {
			if (state.side === "left") fly.style.left = `${rail2.width + 6}px`;
			else fly.style.right = `${rail2.width + 6}px`;
			const from = p?.spec.alignStart ? rail2.top : tr ? tr.top : 0;
			fly.style.top = `${Math.max(4, Math.min(innerHeight - fr.height - 4, from))}px`;
		}
	}

	let layoutQueued = false;
	function layoutSoon() {
		if (layoutQueued) return;
		layoutQueued = true;
		setTimeout(() => {
			layoutQueued = false;
			place();
		});
	}

	sizer.addEventListener("pointerdown", (e) => {
		if (e.button !== 0 || !active) return;
		e.preventDefault();
		const startX = e.clientX;
		const startW = fly.offsetWidth;
		const dir = state.side === "right" ? -1 : 1;
		const id = active;
		const move = (ev) => {
			state.widths[id] = clampW(panelOf(id), startW + dir * (ev.clientX - startX));
			place();
		};
		const up = () => {
			removeEventListener("pointermove", move);
			removeEventListener("pointerup", up);
			save();
		};
		addEventListener("pointermove", move);
		addEventListener("pointerup", up);
	});

	const onResize = () => place();
	addEventListener("resize", onResize);
	const ro = new ResizeObserver(() => place());
	ro.observe(fly);
	ro.observe(rail);

	// ---------- stepping aside for the game's own popups ----------
	// The game draws a beep across the top strip of its canvas for a few seconds (ServerBeep), and its
	// screens put their notices there too. While one is up, any part of the dock over that strip fades
	// out and lets clicks through, so the popup can be read and clicked; it comes back when it's gone.
	const POPUP_BAND = 0.07; // top 7% of the canvas (the beep box is 50 of 1000 game units tall)
	function gamePopupUp() {
		try {
			return typeof ServerBeep !== "undefined" && ServerBeep && ServerBeep.Timer > Date.now() && !!ServerBeep.Message;
		} catch {
			return false;
		}
	}
	function overlapsBand(r, band) {
		return r.width > 0 && r.top < band.bottom && r.bottom > band.top && r.left < band.right && r.right > band.left;
	}
	const yieldTimer = setInterval(() => {
		let yieldNow = false;
		if (gamePopupUp()) {
			const c = document.getElementById("MainCanvas")?.getBoundingClientRect();
			if (c && c.width) {
				const band = { top: c.top, bottom: c.top + c.height * POPUP_BAND, left: c.left, right: c.right };
				yieldNow = overlapsBand(rail.getBoundingClientRect(), band) || (!fly.classList.contains("closed") && overlapsBand(fly.getBoundingClientRect(), band));
			}
		}
		if (yieldNow !== document.documentElement.classList.contains("bcd-yield")) document.documentElement.classList.toggle("bcd-yield", yieldNow);
	}, 250);

	function insertSorted(p) {
		const after = [...panels.values()].filter((q) => q !== p && q.tab.isConnected).sort((a, b) => a.spec.order - b.spec.order).find((q) => q.spec.order > p.spec.order);
		rail.insertBefore(p.tab, after ? after.tab : cfgTab);
	}

	// ---------- handles ----------
	// Handles find their panel through window.BCDock on every call, so they survive a newer dock taking over.
	function handleFor(id) {
		const cur = () => window.BCDock?._panels?.get(id);
		const call =
			(m) =>
			(...a) =>
				cur()?.[m]?.(...a);
		return {
			id,
			get body() {
				return cur()?.body;
			},
			get actions() {
				return cur()?.actions;
			},
			setTitle: call("setTitle"),
			setSummary: call("setSummary"),
			setBadge: call("setBadge"),
			setDot: call("setDot"),
			setVisible: call("setVisible"),
			open: () => window.BCDock?._setOpen(id, true),
			close: () => window.BCDock?._setOpen(id, false),
			toggle: () => window.BCDock?._setOpen(id, !window.BCDock?.isOpen(id)),
			isOpen: () => !!window.BCDock?.isOpen(id),
			remove: () => window.BCDock?._remove(id),
		};
	}

	function add(spec) {
		if (!spec || typeof spec.id !== "string" || !spec.id || spec.id === CFG) throw new Error("BCDock.add needs an id");
		if (panels.has(spec.id)) remove(spec.id); // an add-on reloading itself
		const p = makePanel(spec);
		panels.set(spec.id, p);
		insertSorted(p);
		// Reopen what was open last time (once it's visible)
		if (state.active === spec.id && !active && p.visible && !spec.onClick) setActive(spec.id);
		layoutSoon();
		return handleFor(spec.id);
	}

	function remove(id) {
		const p = panels.get(id);
		if (!p) return;
		if (active === id) {
			// Usually an add-on reloading itself: keep it marked open so its new copy reopens
			setActive(null);
			state.active = id;
			save();
		}
		p.tab.remove();
		panels.delete(id);
		layoutSoon();
	}

	function setOpen(id, open) {
		const p = panels.get(id);
		if (!p || p.spec.onClick) return;
		if (open) {
			if (!p.visible) return;
			setActive(id);
		} else if (active === id) setActive(null);
	}

	// ---------- developer: reload the add-ons from their files without reloading the game ----------
	// Chrome lets a page read a folder you pick once (the bc folder, which holds bc-dock, bc-little-black-book, …);
	// the choice is kept in this site's IndexedDB. Each add-on removes its previous copy when it runs again,
	// so running the file's new text is the whole reload. A file with a syntax error never starts, so the
	// previous copy keeps running.
	const ADDONS = {
		dock: { dir: "bc-dock", file: "bc-dock.js", label: "Dock" },
		book: { dir: "bc-little-black-book", file: "little-black-book.js", label: "Little Black Book" },
		qa: { dir: "bc-quick-actions", file: "quick-actions.js", label: "Quick Actions" },
		vibe: { dir: "bc-vibe-link", file: "vibe-link.js", label: "Vibe Link" },
		ag: { dir: "bc-afterglow", file: "afterglow.js", label: "Afterglow" },
		quiet: { dir: "bc-quiet", file: "quiet.js", label: "Quiet" },
		hr: { dir: "bc-held-remote", file: "held-remote.js", label: "Held Remote" },
		vf: { dir: "bc-vibe-fix", file: "vibe-fix.js", label: "Vibe Fix" },
	};
	const DEV_ORDER = ["dock", "book", "qa", "vibe", "ag", "quiet", "hr", "vf"]; // the dock first, so the add-ons land in the new one
	// Hidden unless a Tampermonkey loader turns them on, so a published copy never shows or runs any of it:
	//   window.BCDockDev = { reload: true, watch: false };
	// reload: the ⚙ Developer section and /reload. watch: also allows "reload whenever a file is saved".
	// Loader bodies run after their @require files, so the flag is read when it's needed, not at start.
	const devCfg = () => (window.BCDockDev && typeof window.BCDockDev === "object" ? window.BCDockDev : {});
	const devOn = () => devCfg().reload === true;
	const watchAllowed = () => devOn() && devCfg().watch === true;
	const dev = { root: prev?._devRoot?.() || null, known: prev?._devKnown?.() || null, busy: false, watchTimer: null, cmdTimer: null, cmd: null };

	function kv(mode, fn) {
		return new Promise((resolve, reject) => {
			const open = indexedDB.open("BCDock", 1);
			open.onupgradeneeded = () => open.result.createObjectStore("kv");
			open.onerror = () => reject(open.error);
			open.onsuccess = () => {
				const db = open.result;
				const tx = db.transaction("kv", mode);
				const req = fn(tx.objectStore("kv"));
				tx.oncomplete = () => (db.close(), resolve(req?.result));
				tx.onerror = () => (db.close(), reject(tx.error));
			};
		});
	}

	function devSay(msg) {
		if (typeof CurrentScreen !== "undefined" && CurrentScreen === "ChatRoom" && typeof ChatRoomSendLocal === "function") ChatRoomSendLocal(`🔧 ${msg}`, 15000);
		console.log("[BCDock]", msg);
	}

	// The chosen folder, if Chrome still lets us read it (asking needs a click or a typed command)
	async function devRoot(ask) {
		if (!dev.root) dev.root = await kv("readonly", (s) => s.get("root")).catch(() => null);
		if (typeof dev.root?.queryPermission !== "function") return (dev.root = null), { root: null, why: "none" };
		let perm = await dev.root.queryPermission({ mode: "read" });
		if (perm !== "granted" && ask) perm = await dev.root.requestPermission({ mode: "read" }).catch(() => "denied");
		return perm === "granted" ? { root: dev.root } : { root: null, why: "permission" };
	}

	async function devFile(root, key) {
		const a = ADDONS[key];
		return (await (await root.getDirectoryHandle(a.dir)).getFileHandle(a.file)).getFile();
	}

	async function devTimes(root) {
		const out = {};
		for (const k of DEV_ORDER) {
			try {
				out[k] = (await devFile(root, k)).lastModified;
			} catch {}
		}
		return out;
	}

	async function pickFolder() {
		if (!devOn()) return;
		if (typeof showDirectoryPicker !== "function") return devSay("This browser can't share a folder with a page; use Chrome or Edge.");
		try {
			const h = await showDirectoryPicker({ id: "bc-addons", mode: "read" });
			await h.getDirectoryHandle("bc-dock"); // the right folder holds the add-on folders
			dev.root = h;
			await kv("readwrite", (s) => s.put(h, "root"));
			dev.known = await devTimes(h);
			devSay(`Add-on folder: "${h.name}". /reload reloads whatever you change.`);
		} catch (e) {
			if (e?.name !== "AbortError")
				devSay(e?.name === "NotFoundError" ? "Pick the folder that holds bc-dock, bc-little-black-book, bc-quick-actions, bc-vibe-link and bc-afterglow (the bc folder)." : `Couldn't use that folder: ${e?.message || e}`);
		}
		if (active === CFG) renderCfg();
	}

	// Runs the file's text in the page, as Tampermonkey did; errors from that run are reported
	function inject(key, code) {
		const errors = [];
		const onErr = (e) => errors.push(`${e.message}${e.lineno ? ` (line ${e.lineno})` : ""}`);
		addEventListener("error", onErr);
		if (key === "dock") window.__bcDockReload = true;
		const s = document.createElement("script");
		s.textContent = `${code}\n//# sourceURL=bc-addons/${ADDONS[key].dir}/${ADDONS[key].file}`;
		document.head.append(s); // an inline script runs right here
		s.remove();
		removeEventListener("error", onErr);
		delete window.__bcDockReload;
		return errors;
	}

	async function devReload(keys, ask = true) {
		if (!devOn()) return;
		if (dev.busy) return devSay("Already reloading…");
		dev.busy = true;
		try {
			const { root, why } = await devRoot(ask);
			if (!root)
				return devSay(why === "none" ? "Pick the add-on folder first: dock ⚙ → Developer → Choose folder." : "Chrome needs your OK to read the add-on folder: press Reload in the dock ⚙ panel.");
			const times = await devTimes(root);
			if (!keys) {
				keys = DEV_ORDER.filter((k) => !dev.known || times[k] !== dev.known[k]);
				if (!keys.length) return devSay("Nothing changed since the last reload. /reload all reloads everything.");
			}
			keys = DEV_ORDER.filter((k) => keys.includes(k));
			const done = [];
			const failed = [];
			let missing = 0;
			for (const k of keys) {
				try {
					const errs = inject(k, await (await devFile(root, k)).text());
					if (errs.length) failed.push(`${ADDONS[k].label}: ${errs.join("; ")}`);
					else done.push(ADDONS[k].label);
				} catch (e) {
					if (e?.name === "NotFoundError") missing++;
					failed.push(`${ADDONS[k].label}: ${e?.message || e}`);
				}
				await new Promise((r) => setTimeout(r, 50));
			}
			dev.known = { ...(dev.known || times), ...Object.fromEntries(keys.map((k) => [k, times[k]])) };
			// After a dock reload the new dock carries on; hand it what was just loaded
			if (window.BCDock !== api) window.BCDock?._devKnownSet?.(dev.known);
			if (done.length) devSay(`Reloaded ${done.join(", ")}.`);
			// Every file missing: the folder picked earlier was moved or renamed, so the saved link to it is dead
			if (missing && missing === failed.length && !done.length)
				devSay(`Not reloaded: the add-on folder "${root.name}" was moved or renamed, so the dock can't find it any more. Dock ⚙ → Developer → Choose folder, and pick the bc folder (the one holding bc-dock). The running versions stay until then.`);
			else if (failed.length) devSay(`Not reloaded (the previous version keeps running): ${failed.join(" · ")}`);
		} catch (e) {
			devSay(`Reload failed: ${e?.message || e}`);
		} finally {
			dev.busy = false;
		}
	}

	function setWatch(on) {
		if (on && !watchAllowed()) {
			if (devOn()) devSay('Reload on save is off in your loader. Add watch: true to window.BCDockDev to allow it.');
			on = false;
		} else {
			state.devWatch = !!on;
			save();
		}
		clearInterval(dev.watchTimer);
		dev.watchTimer = null;
		if (on)
			dev.watchTimer = setInterval(async () => {
				if (dev.busy || window.BCDock !== api || !watchAllowed()) return;
				const { root } = await devRoot(false);
				if (!root) return;
				const times = await devTimes(root);
				if (!dev.known) return void (dev.known = times);
				const changed = DEV_ORDER.filter((k) => times[k] !== dev.known[k]);
				if (changed.length) devReload(changed, false);
			}, 1000);
		if (active === CFG) renderCfg();
	}

	function reloadCommand(argText) {
		const arg = String(argText || "").trim().toLowerCase();
		if (!arg) return devReload(null);
		if (arg === "watch") return setWatch(true), watchAllowed() && devSay("Reloading add-ons whenever their file is saved. /reload unwatch stops.");
		if (arg === "unwatch" || arg === "stop") return setWatch(false), devSay("Stopped reloading on save.");
		if (arg === "all") return devReload(DEV_ORDER);
		if (arg === "folder") return pickFolder();
		const keys = arg.split(/[\s,]+/).map((w) => ({ lbb: "book", quick: "qa", vl: "vibe", link: "vibe", afterglow: "ag" })[w] || w);
		const bad = keys.filter((k) => !ADDONS[k]);
		if (bad.length) return devSay(`Unknown: ${bad.join(", ")}. /reload [all|book|qa|vibe|ag|dock|watch|unwatch|folder]`);
		return devReload(keys);
	}

	dev.cmd = { Tag: "reload", Description: "[all|book|qa|vibe|dock|watch|unwatch|folder]: reload the add-ons from their files (dock ⚙ → Developer)", Action: reloadCommand };
	// Once the game's command list exists (and the loaders have run), the developer tools start, or stay off for good
	dev.cmdTimer = setInterval(() => {
		if (typeof Commands === "undefined" || typeof CommandCombine !== "function") return;
		clearInterval(dev.cmdTimer);
		if (!devOn()) return;
		devStart();
		if (Commands.some((c) => c.Tag === "reload")) return console.warn("[BCDock] /reload is taken by another add-on; use the dock ⚙ panel");
		CommandCombine([dev.cmd]);
	}, 1000);

	function devStop() {
		clearInterval(dev.watchTimer);
		clearInterval(dev.cmdTimer);
		if (typeof Commands !== "undefined") {
			const i = Commands.indexOf(dev.cmd);
			if (i >= 0) Commands.splice(i, 1);
		}
	}

	// The versions running now came from the files when the page loaded (or from the previous dock's reload)
	function devStart() {
		devRoot(false)
			.then(async ({ root }) => {
				if (root && !dev.known) dev.known = await devTimes(root);
			})
			.catch(() => {});
		if (state.devWatch && watchAllowed()) setWatch(true);
		if (active === CFG) renderCfg();
	}

	function devSection() {
		const status = el("span", { class: "hint", style: "flex:1" }, "…");
		devRoot(false)
			.then(({ root, why }) => {
				status.textContent = root ? `Folder: ${root.name}` : why === "permission" ? `Folder: ${dev.root.name} (needs your OK: press Reload)` : "No folder chosen";
			})
			.catch(() => (status.textContent = "No folder chosen"));
		return [
			el("h4", {}, "Developer"),
			el("div", { class: "row" }, status, el("button", { onclick: pickFolder }, "Choose folder")),
			el(
				"div",
				{ class: "row" },
				el("button", { onclick: () => devReload(null) }, "Reload changed"),
				el("button", { onclick: () => devReload(DEV_ORDER) }, "Reload all"),
				watchAllowed() ? el("label", {}, el("input", { type: "checkbox", checked: !!state.devWatch, onchange: (e) => setWatch(e.target.checked) }), " on save") : null
			),
			el("div", { class: "hint" }, `Reloads the add-ons from their files without reloading the game (choose the bc folder once). Chat: /reload, /reload all${watchAllowed() ? ", /reload watch" : ""}. Turned on by window.BCDockDev in your loader.`),
		];
	}

	// ---------- BC Toolkit loader ----------
	// With the one BC Toolkit script (bc-toolkit.user.js) the dock also loads the add-ons. ⚙ → Add-ons has a menu for
	// each: Off, Latest, or a fixed version. The list of add-ons and their versions (toolkit.json) comes from the
	// repository's main branch; each add-on's file comes from its release tag through jsDelivr, exactly like the
	// separate scripts' @require lines, so a version never changes under you. Latest moves to a new release when the
	// game loads, or on "Check for updates". Turned on by this line in that script's body:
	//   window.BCToolkit = { loader: true };
	// Without it (the separate add-on scripts) none of this runs. listUrl and fileBase ("…/{tag}/") in the same object
	// point it somewhere else, for testing.
	const TK_LISTS = ["https://raw.githubusercontent.com/BountyHunter9000/bc-toolkit/main/toolkit.json", "https://cdn.jsdelivr.net/gh/BountyHunter9000/bc-toolkit@main/toolkit.json"];
	const TK_FILES = "https://cdn.jsdelivr.net/gh/BountyHunter9000/bc-toolkit@{tag}/";
	const tkCfg = () => (window.BCToolkit && typeof window.BCToolkit === "object" ? window.BCToolkit : {});
	const tkOn = () => tkCfg().loader === true;
	// Carried over when a newer dock takes over, so nothing is loaded twice.
	// mine: versions this loader started; own: add-ons already running from their own Tampermonkey script (left alone)
	const tk = prev?._tk?.() || { started: false, list: null, listAt: 0, listErr: null, mine: {}, own: {}, busy: {}, err: {}, checking: false };
	let tkTimer = null;
	let tkStatusTimer = null;

	// Only what the loader needs, checked, so a broken list can't point it at anything but this repository's files
	function tkClean(raw) {
		if (!raw || raw.format !== "BCToolkit" || !Array.isArray(raw.addons)) return null;
		const ok = (re, v) => typeof v === "string" && re.test(v);
		const addons = raw.addons
			.filter((a) => a && ok(/^[a-z]{1,12}$/, a.id) && ok(/^[\w-]+\/[\w.-]+\.js$/, a.path) && ok(/^[A-Z][A-Za-z]{1,29}$/, a.global) && a.global !== "BCDock" && ok(/^[a-z]{1,8}-v$/, a.prefix) && Array.isArray(a.versions))
			.map((a) => ({
				id: a.id,
				name: String(a.name || a.id).slice(0, 40),
				icon: String(a.icon || "").slice(0, 4),
				about: String(a.about || "").slice(0, 160),
				path: a.path,
				global: a.global,
				prefix: a.prefix,
				versions: a.versions.filter((v) => ok(/^\d+\.\d+\.\d+$/, v)).slice(0, 20),
			}));
		return addons.length ? { format: "BCToolkit", addons } : null;
	}

	async function tkFetch() {
		const urls = typeof tkCfg().listUrl === "string" ? [tkCfg().listUrl] : TK_LISTS;
		for (const u of urls) {
			const ctl = new AbortController();
			const t = setTimeout(() => ctl.abort(), 8000);
			try {
				const r = await fetch(u, { cache: "no-store", signal: ctl.signal });
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				const list = tkClean(await r.json());
				if (!list) throw new Error("not a BC Toolkit list");
				tk.list = list;
				tk.listAt = Date.now();
				tk.listErr = null;
				state.tkList = { ...list, at: tk.listAt };
				save();
				return true;
			} catch (e) {
				tk.listErr = e?.name === "AbortError" ? "timed out" : e?.message || String(e);
			} finally {
				clearTimeout(t);
			}
		}
		// Offline or blocked: the list from last time still says what to load
		if (!tk.list) {
			const cached = tkClean(state.tkList);
			if (cached) (tk.list = cached), (tk.listAt = state.tkList.at || 0);
		}
		return false;
	}

	// Every add-on runs at Latest until you pick something else (add-ons new to the list too)
	const tkPick = (id) => (state.tk && typeof state.tk[id] === "string" ? state.tk[id] : "latest");
	function tkWant(a) {
		const p = tkPick(a.id);
		if (p === "latest") return a.versions[0] || null;
		return /^\d+\.\d+\.\d+$/.test(p) ? p : null;
	}
	function tkRunning(a) {
		try {
			const g = window[a.global];
			return g && typeof g === "object" ? String(g.version || "?") : null;
		} catch {
			return null;
		}
	}
	const tkUrl = (a, v) => (typeof tkCfg().fileBase === "string" ? tkCfg().fileBase : TK_FILES).replace("{tag}", a.prefix + v) + a.path;

	// Adds the add-on's file as a script from its release. A copy already running is replaced by the new one itself
	// (each add-on unloads its previous copy when it starts), so switching versions needs no reload.
	function tkLoad(a, v) {
		tk.busy[a.id] = true;
		delete tk.err[a.id];
		tkRender();
		const url = tkUrl(a, v);
		return new Promise((resolve) => {
			const errs = [];
			const onErr = (e) => e.filename === url && errs.push(`${e.message}${e.lineno ? ` (line ${e.lineno})` : ""}`);
			addEventListener("error", onErr);
			const s = document.createElement("script");
			s.crossOrigin = "anonymous"; // so an error in the file is reported with its message, not as "Script error."
			s.src = url;
			const done = (msg) => {
				removeEventListener("error", onErr);
				s.remove();
				delete tk.busy[a.id];
				if (msg || errs.length) {
					tk.err[a.id] = msg || errs.join("; ");
					console.warn("[BCDock]", `${a.name} v${v} didn't load: ${tk.err[a.id]}`);
				} else {
					tk.mine[a.id] = v;
					console.log("[BCDock]", `loaded ${a.name} v${v}`);
				}
				tkRender();
				resolve();
			};
			s.onload = () => done(null);
			s.onerror = () => done("couldn't download it");
			document.head.append(s);
		});
	}

	function tkUnload(a) {
		try {
			window[a.global]?.unload?.();
			console.log("[BCDock]", `turned off ${a.name}`);
		} catch (e) {
			console.warn("[BCDock]", `${a.name} didn't unload cleanly`, e);
		}
		delete tk.mine[a.id];
		delete tk.err[a.id];
	}

	// Brings one add-on to what its menu says
	async function tkApply(a) {
		if (tk.own[a.id] || tk.busy[a.id]) return;
		const want = tkWant(a);
		const have = tk.mine[a.id] || null;
		if (!want) {
			if (have) tkUnload(a);
			return tkRender();
		}
		if (have === want && !tk.err[a.id]) return;
		await tkLoad(a, want);
	}

	function tkSet(id, pick) {
		if (pick !== "off" && pick !== "latest" && !/^\d+\.\d+\.\d+$/.test(pick)) return;
		state.tk = { ...(state.tk || {}), [id]: pick };
		save();
		const a = tk.list?.addons.find((x) => x.id === id);
		if (a && tk.started) tkApply(a);
		tkRender();
	}

	async function tkCheck() {
		if (tk.checking) return;
		tk.checking = true;
		tkRender();
		try {
			await tkFetch();
			if (tk.started) for (const a of tk.list?.addons || []) await tkApply(a);
		} finally {
			tk.checking = false;
			tkRender();
		}
	}

	async function tkStart() {
		tk.started = true;
		place();
		await tkFetch();
		// Add-ons that their own Tampermonkey scripts already started are left to those scripts
		for (const a of tk.list?.addons || []) {
			const v = tkRunning(a);
			if (v && !tk.mine[a.id]) tk.own[a.id] = v;
		}
		for (const a of tk.list?.addons || []) await tkApply(a);
		console.log("[BCDock]", `BC Toolkit: ${Object.entries(tk.mine).map(([id, v]) => `${id} v${v}`).join(", ") || "no add-ons switched on (⚙ → Add-ons)"}`);
		tkRender();
	}

	// The script's body sets the flag after this file runs, and separate add-on scripts may start their own copies
	// meanwhile, so the loader starts a little after the game's scripts are there
	function tkWatch() {
		let n = 0;
		clearInterval(tkTimer);
		tkTimer = setInterval(() => {
			if (tk.started || window.BCDock !== api || ++n > 120) return clearInterval(tkTimer);
			if (!tkOn() || typeof bcModSdk === "undefined" || typeof Player === "undefined" || typeof CommandCombine !== "function") return;
			clearInterval(tkTimer);
			setTimeout(() => !tk.started && window.BCDock === api && tkStart(), 2000);
		}, 500);
		// The status lines under the menus change as add-ons start; updated in place so an open menu stays open
		clearInterval(tkStatusTimer);
		tkStatusTimer = setInterval(() => {
			if (active !== CFG || !tkOn()) return;
			for (const a of tk.list?.addons || []) {
				const node = cfgBody.querySelector(`.st[data-tk="${a.id}"]`);
				if (!node) continue;
				const [cls, text] = tkStatus(a);
				if (node.textContent !== text) node.textContent = text;
				node.className = `st ${cls}`;
			}
		}, 1500);
	}

	const tkRender = () => {
		if (active === CFG && window.BCDock === api) renderCfg();
	};

	function tkStatus(a) {
		if (tk.own[a.id]) return ["", `v${tk.own[a.id]} runs from its own Tampermonkey script. Turn that script off to choose here.`];
		if (tk.busy[a.id]) return ["", "loading…"];
		if (tk.err[a.id]) return ["bad", `didn't load: ${tk.err[a.id]}`];
		const want = tkWant(a);
		const run = tkRunning(a);
		if (!want) return run ? ["bad", `v${run} still running; reload the game to stop it`] : ["", ""];
		if (run === want) return ["ok", `v${run} running`];
		if (tk.mine[a.id] === want) return ["", `v${want} starting…`];
		if (!tk.started) return ["", ""];
		return ["", `v${want} not loaded yet`];
	}

	function tkAge() {
		if (!tk.listAt) return "";
		const m = Math.round((Date.now() - tk.listAt) / 60000);
		const ago = m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
		return `List checked ${ago}${tk.listErr ? ` (couldn't check now: ${tk.listErr})` : ""}`;
	}

	function tkSection() {
		if (!tk.started) return [el("div", { class: "hint" }, "The add-ons start once the game has loaded…")];
		const list = tk.list?.addons;
		if (!list)
			return [
				el("div", { class: "hint" }, `Couldn't get the list of add-ons${tk.listErr ? ` (${tk.listErr})` : ""}.`),
				el("div", { class: "row" }, el("button", { onclick: tkCheck, disabled: tk.checking }, tk.checking ? "Checking…" : "Try again")),
			];
		const rows = list.flatMap((a) => {
			const pick = tkPick(a.id);
			const sel = el(
				"select",
				{ title: a.about, disabled: !!tk.own[a.id], onchange: (e) => tkSet(a.id, e.target.value) },
				el("option", { value: "off" }, "Off"),
				el("option", { value: "latest" }, a.versions[0] ? `Latest (${a.versions[0]})` : "Latest"),
				a.versions.map((v) => el("option", { value: v }, `v${v}`)),
				// a fixed version that has dropped off the list stays as it is
				/^\d/.test(pick) && !a.versions.includes(pick) ? el("option", { value: pick }, `v${pick}`) : null
			);
			sel.value = pick;
			const [cls, text] = tkStatus(a);
			return [el("span", { title: a.about }, `${a.icon ? a.icon + " " : ""}${a.name}`), sel, el("div", { class: `st ${cls}`, "data-tk": a.id }, text)];
		});
		return [
			el("div", { class: "tk" }, rows),
			el("div", { class: "row" }, el("span", { class: "hint", style: "flex:1" }, tkAge()), el("button", { onclick: tkCheck, disabled: tk.checking }, tk.checking ? "Checking…" : "Check for updates")),
			el("div", { class: "hint" }, "Changes apply right away. Latest moves to new releases each time the game loads. An older version may not read what a newer one saved."),
		];
	}

	// ---------- start ----------
	document.head.append(style);
	rail.append(cfgTab);
	document.body.append(rail, fly);
	document.documentElement.style.setProperty("--bcd-opacity", String(state.opacity));

	// Take over from an older dock, keeping its panels' elements so the add-ons' references stay valid
	let reopen = null;
	if (prev?._takeover) {
		const taken = prev._takeover();
		for (const old of taken.panels || taken) {
			const p = makePanel(old.spec, old);
			panels.set(old.spec.id, p);
			insertSorted(p);
		}
		reopen = taken.active || null;
	}
	place();
	titleStart();

	const api = {
		version: VERSION,
		theme: () => themeColors(), // current palette (CSS variable -> value); "bcdock:theme" fires on window when it changes
		add,
		isOpen: (id) => active === id && !!panels.get(id),
		// A marker in front of the name in the browser tab (an emoji or two), e.g. setTitleMark("quiet", "🔕"); null
		// removes it. Several add-ons' markers show side by side.
		setTitleMark,
		reset() {
			state.side = "left";
			state.y = state.x = null;
			state.widths = {};
			save();
			place();
			if (active === CFG) renderCfg();
		},
		_panels: panels,
		_setOpen: setOpen,
		_remove: remove,
		_devKnown: () => dev.known,
		_devRoot: () => dev.root,
		_devKnownSet: (k) => (dev.known = { ...(dev.known || {}), ...k }),
		_titleMarks: () => [...titleMarks],
		// BC Toolkit loader (bc-toolkit.user.js): what's loaded, menus, and a fresh look at the list
		toolkit: {
			status: () => Object.fromEntries((tk.list?.addons || []).map((a) => [a.id, { pick: tkPick(a.id), running: tkRunning(a), status: tkStatus(a)[1] }])),
			set: tkSet,
			check: tkCheck,
		},
		_tk: () => tk,
		_takeover() {
			clearInterval(tkTimer);
			clearInterval(tkStatusTimer);
			const out = {
				active: active === CFG ? null : active,
				panels: [...panels.values()].map((p) => ({
					spec: p.spec,
					visible: p.visible,
					badge: p.badge,
					summary: p.sum,
					dotClass: p.dot.className,
					actions: p.actions,
					body: p.body,
				})),
			};
			removeEventListener("resize", onResize);
			ro.disconnect();
			clearInterval(yieldTimer);
			document.documentElement.classList.remove("bcd-yield");
			devStop();
			titleStop();
			rail.remove();
			fly.remove();
			style.remove();
			panels.clear();
			return out;
		},
	};
	window.BCDock = api;
	tkWatch();
	if (reopen) setActive(reopen);
})();
