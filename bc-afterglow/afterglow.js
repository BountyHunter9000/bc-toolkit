// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// Afterglow for Bondage Club
// Keeps count of your orgasms, ruined orgasms, resisted orgasms and denials, the time since your last orgasm, and
// your records: the longest you've gone without one, and the most denials (ruins, resists) between two.
// It only watches the game's own orgasm functions (ModSDK hooks that call the game first and change nothing) and
// never sends anything. Counts and records go with your account; the event log stays in this browser.
(async () => {
	"use strict";

	const MOD_INFO = { name: "BCT_Afterglow", fullName: "Afterglow", version: "0.3.0" };
	const TAG = "[Afterglow]";
	const SETTINGS_KEY = "Afterglow";
	const LOG_MAX = 1000;
	const DENY_GAP_MS = 60_000; // held at the edge without a break this long counts as one denial
	const DENY_DROP = 90; // ... and so does dropping below this arousal and coming back
	// Time away: while you're logged in and connected, "still here" is noted every minute in this browser (and every
	// ALIVE_SAVE_MS with the account, for other computers). At the next login, a gap longer than AWAY_MIN_MS since the
	// last note was time away.
	const ALIVE_EVERY_MS = 60_000;
	const ALIVE_SAVE_MS = 10 * 60_000;
	const AWAY_MIN_MS = 2 * 60_000;
	const AWAY_MAX = 300;

	// Re-running the script (dev reload) replaces the previous instance
	if (window.Afterglow && typeof window.Afterglow.unload === "function") window.Afterglow.unload();

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	while (typeof bcModSdk === "undefined" || typeof Player === "undefined" || typeof ActivityOrgasmStart === "undefined") await sleep(250);

	const mod = bcModSdk.registerMod(MOD_INFO);

	const KINDS = {
		orgasm: { label: "Orgasms", one: "Orgasm", icon: "💦" },
		ruined: { label: "Ruined", one: "Ruined", icon: "💔" },
		resisted: { label: "Resisted", one: "Resisted", icon: "✊" },
		failed: { label: "Resist failed", one: "Resist failed", icon: "😵" }, // tried to resist and came anyway: also an orgasm
		denied: { label: "Denied", one: "Denied", icon: "⛔" },
	};
	const KIND_KEYS = Object.keys(KINDS);
	const STREAK_KEYS = ["denied", "ruined", "resisted"]; // counted between two orgasms
	const HELD_KEYS = ["denied", "ruined"]; // these also time how long the effect has been on you

	// ---------- state (with the account) ----------
	// since: when Afterglow started counting on this account. lastOrgasmAt: the last orgasm it saw (null: none yet,
	// so the current stretch is counted from `since` and is only a lower bound). streak: denials, ruins and resists
	// since then. rec: the longest stretch without an orgasm (gap) and the most of each in one stretch.
	const fresh = () => ({
		v: 1,
		since: Date.now(),
		totals: { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 },
		base: { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 }, // from before Afterglow, entered by hand
		last: {},
		lastOrgasmAt: null,
		streakStart: Date.now(),
		streak: { denied: 0, ruined: 0, resisted: 0 },
		rec: { gap: null, gapOnline: null, denied: 0, ruined: 0, resisted: 0 },
		show: "orgasm", // what the dock tab shows: the orgasm clock, or the denied / ruined / resisted box
		held: { denied: 0, ruined: 0 }, // since when a denial (or edging) / ruin effect has been on you, 0: none now
		timeMode: "real", // "real": clocks and records count all time; "online": only time you were logged in
		alive: 0, // the last "still here" saved with the account (every few minutes), to find time away on another device
		away: [], // [from, to]: stretches you were away (logged out, tab closed, disconnected), newest last
	});
	let state = fresh();
	let loadedFor = null;

	function clean(s) {
		const out = fresh();
		if (!s || typeof s !== "object") return out;
		const num = (v, d = 0) => (Number.isFinite(+v) && +v >= 0 ? Math.round(+v) : d);
		out.since = num(s.since, out.since);
		for (const k of KIND_KEYS) out.totals[k] = num(s.totals?.[k]);
		for (const k of KIND_KEYS) out.base[k] = num(s.base?.[k]);
		for (const k of KIND_KEYS) if (num(s.last?.[k])) out.last[k] = num(s.last[k]);
		out.lastOrgasmAt = num(s.lastOrgasmAt) || null;
		out.streakStart = num(s.streakStart, out.lastOrgasmAt || out.since);
		for (const k of STREAK_KEYS) out.streak[k] = num(s.streak?.[k]);
		for (const k of STREAK_KEYS) out.rec[k] = num(s.rec?.[k]);
		if (KINDS[s.show]) out.show = s.show;
		for (const k of HELD_KEYS) out.held[k] = num(s.held?.[k]);
		const gap = (g) => (g && num(g.ms) ? { ms: num(g.ms), from: num(g.from), to: num(g.to), exact: !!g.exact, ...(g.manual ? { manual: true } : {}) } : null);
		out.rec.gap = gap(s.rec?.gap);
		// Records from before time away was tracked: all of it counts as online
		out.rec.gapOnline = s.rec && "gapOnline" in s.rec ? gap(s.rec.gapOnline) : out.rec.gap && { ...out.rec.gap };
		if (s.timeMode === "online") out.timeMode = "online";
		out.alive = num(s.alive);
		out.away = (Array.isArray(s.away) ? s.away : [])
			.filter((a) => Array.isArray(a) && num(a[0]) && num(a[1]) > num(a[0]))
			.map((a) => [num(a[0]), num(a[1])])
			.slice(-AWAY_MAX);
		return out;
	}
	function load() {
		try {
			const raw = Player.ExtensionSettings?.[SETTINGS_KEY];
			state = typeof raw === "string" && raw ? clean(JSON.parse(LZString.decompressFromUTF16(raw))) : fresh();
		} catch (e) {
			console.warn(TAG, "load failed", e);
			state = fresh();
		}
		log = readLog();
		session = { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 };
		const before = Math.max(state.alive || 0, readAlive());
		const now = Date.now();
		if (before && now - before > AWAY_MIN_MS) addAway(before, now);
		markAlive(true);
		if (!Player.ExtensionSettings?.[SETTINGS_KEY]) save(); // the first day: remember when counting started
	}

	// ---------- time away ----------
	const aliveKey = () => `Afterglow.alive.${Player.MemberNumber || 0}`;
	function readAlive() {
		try {
			return Number(localStorage.getItem(aliveKey())) || 0;
		} catch {
			return 0;
		}
	}
	let aliveAt = 0;
	let aliveSavedAt = 0;
	function markAlive(force = false) {
		const now = Date.now();
		if (!force && now - aliveAt < ALIVE_EVERY_MS) return;
		aliveAt = now;
		try {
			localStorage.setItem(aliveKey(), String(now));
		} catch {}
		if (force || now - aliveSavedAt >= ALIVE_SAVE_MS) {
			aliveSavedAt = now;
			state.alive = now;
			save();
		}
	}
	const connected = () => typeof ServerIsConnected === "undefined" || ServerIsConnected !== false;
	function addAway(from, to) {
		state.away.push([from, to]);
		// Only stretches inside one of the running clocks or the record still matter
		const keep = Math.min(state.streakStart, ...Object.values(state.last));
		state.away = state.away.filter((a) => a[1] > keep).slice(-AWAY_MAX);
		log.push([from, "away", "", to - from]);
		if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
		writeLog();
		save();
	}
	// Time away between a and b
	function awayBetween(a, b) {
		let ms = 0;
		for (const [f, t] of state.away) ms += Math.max(0, Math.min(t, b) - Math.max(f, a));
		return ms;
	}
	// How long since t: all of it, or only time online (state.timeMode)
	const elapsed = (t, mode = state.timeMode) => Math.max(0, Date.now() - t - (mode === "online" ? awayBetween(t, Date.now()) : 0));
	const recGap = () => (state.timeMode === "online" ? state.rec.gapOnline : state.rec.gap);
	let saveTimer = null;
	function save() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			if (!Player.ExtensionSettings || !Player.MemberNumber || loadedFor !== Player.MemberNumber) return;
			Player.ExtensionSettings[SETTINGS_KEY] = LZString.compressToUTF16(JSON.stringify(state));
			if (typeof ServerPlayerExtensionSettingsSync === "function") ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
		}, 1500);
	}

	// ---------- event log (this browser only) ----------
	// [time, kind, room, how?]: for "today" and the recent list
	let log = [];
	let session = { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 };
	const logKey = () => `Afterglow.log.${Player.MemberNumber || 0}`;
	function readLog() {
		try {
			const raw = JSON.parse(localStorage.getItem(logKey()) || "[]");
			return Array.isArray(raw) ? raw.filter((e) => Array.isArray(e) && Number.isFinite(e[0]) && (KINDS[e[1]] || e[1] === "away")).slice(-LOG_MAX) : [];
		} catch {
			return [];
		}
	}
	function writeLog() {
		try {
			localStorage.setItem(logKey(), JSON.stringify(log));
		} catch {}
	}

	// ---------- counting ----------
	const roomName = () => (typeof ChatRoomData !== "undefined" && ChatRoomData?.Name) || "";
	function record(kind, how) {
		if (!Player.MemberNumber || loadedFor !== Player.MemberNumber) return;
		const now = Date.now();
		state.totals[kind]++;
		state.last[kind] = now;
		session[kind]++;
		if (how === "failed") {
			state.totals.failed++;
			state.last.failed = now;
			session.failed++;
		}
		if (kind === "orgasm") {
			// The stretch that just ended: a new record if it's the longest (only a lower bound if it started at install)
			const gap = now - state.streakStart;
			const online = gap - awayBetween(state.streakStart, now);
			const span = { from: state.streakStart, to: now, exact: !!state.lastOrgasmAt };
			if (!state.rec.gap || gap > state.rec.gap.ms) state.rec.gap = { ms: gap, ...span };
			if (!state.rec.gapOnline || online > state.rec.gapOnline.ms) state.rec.gapOnline = { ms: online, ...span };
			for (const k of STREAK_KEYS) state.streak[k] = 0;
			state.lastOrgasmAt = now;
			state.streakStart = now;
		} else {
			state.streak[kind]++;
			if (state.streak[kind] > state.rec[kind]) state.rec[kind] = state.streak[kind];
		}
		// An orgasm, ruin or resist ends any spell at the edge: the next denial is a new one
		if (kind !== "denied") dropped = true;
		log.push(how ? [now, kind, roomName(), how] : [now, kind, roomName()]);
		if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
		writeLog();
		save();
		ui.render();
	}

	// Denial and edging hold you at the edge, and the game asks again every time the meter refills, so one spell at
	// the edge counts once: again only after a minute without being stopped, or after arousal dropped and came back.
	let denyHitAt = 0;
	let dropped = true;
	function denyHit(how) {
		const now = Date.now();
		if (dropped || now - denyHitAt > DENY_GAP_MS) record("denied", how);
		denyHitAt = now;
		dropped = false;
	}

	// What's on you now: a denial (or edging) effect holds you at the edge; a ruin effect ruins the orgasm instead
	const effects = () => (Array.isArray(Player.Effect) ? Player.Effect : []);
	const edged = () => {
		try {
			return (typeof Player.IsEdged === "function" && Player.IsEdged()) || (typeof InventoryCraftCount === "function" && InventoryCraftCount(Player, "Edging") > 0);
		} catch {
			return false;
		}
	};
	const heldNow = {
		denied: () => (effects().includes("DenialMode") && !effects().includes("RuinOrgasms")) || edged(),
		ruined: () => effects().includes("RuinOrgasms"),
	};
	// Start or stop the "held for" timers when such an item goes on or comes off. The effect list can be empty for a
	// moment while the game redraws you, so it has to stay off a few seconds before the timer stops.
	const offSince = { denied: 0, ruined: 0 };
	function checkHeld() {
		if (!Player.MemberNumber || loadedFor !== Player.MemberNumber || !Array.isArray(Player.Appearance) || !Player.Appearance.length) return;
		let changed = false;
		for (const k of HELD_KEYS) {
			const on = heldNow[k]();
			if (on) offSince[k] = 0;
			if (on && !state.held[k]) {
				state.held[k] = Date.now();
				changed = true;
			} else if (!on && state.held[k]) {
				offSince[k] ||= Date.now();
				if (Date.now() - offSince[k] >= 5000) {
					state.held[k] = 0;
					offSince[k] = 0;
					changed = true;
				}
			}
		}
		if (changed) {
			save();
			ui.render();
		}
	}

	const isMe = (C) => !!C && (typeof C.IsPlayer === "function" ? C.IsPlayer() : C === Player);
	const orgasmTimer = () => Player.ArousalSettings?.OrgasmTimer || 0;
	const safely = (fn) => {
		try {
			fn();
		} catch (e) {
			console.warn(TAG, e);
		}
	};

	// The game runs first in every hook; we only look at what happened
	// An orgasm, or a ruined one (the game's ActivityOrgasmRuined says which). If the resist mini-game was still
	// running (OrgasmStage 1), its time ran out: you tried to resist and came anyway.
	mod.hookFunction("ActivityOrgasmStart", 0, (args, next) => {
		const mine = isMe(args[0]);
		const ruined = mine && typeof ActivityOrgasmRuined !== "undefined" && ActivityOrgasmRuined === true;
		const failed = mine && !ruined && Player.ArousalSettings?.OrgasmStage === 1;
		const r = next(args);
		if (mine) safely(() => record(ruined ? "ruined" : "orgasm", failed ? "failed" : undefined));
		return r;
	});
	// The resist mini-game: winning it ends the orgasm timer
	mod.hookFunction("ActivityOrgasmGameGenerate", 0, (args, next) => {
		const before = orgasmTimer();
		const r = next(args);
		if (args[0] > 0 && before > 0 && orgasmTimer() === 0) safely(() => record("resisted"));
		return r;
	});
	// A ruined orgasm that runs out its time (or that you push through) ends here, every frame until it fires
	mod.hookFunction("ActivityOrgasmControl", 0, (args, next) => {
		const before = orgasmTimer();
		const r = next(args);
		if (before > 0 && orgasmTimer() === 0) safely(() => record("ruined"));
		return r;
	});
	// Full arousal: a denial or edging effect holds you at the edge instead (unless it's a forced, ruined one)
	mod.hookFunction("ActivityOrgasmPrepare", 0, (args, next) => {
		const [C, bypass] = args;
		let how = null;
		if (isMe(C))
			safely(() => {
				const fx = Array.isArray(C.Effect) ? C.Effect : [];
				if (fx.includes("DenialMode") && !(bypass || fx.includes("RuinOrgasms"))) how = "denial";
				else if (!bypass && edged()) how = "edge";
			});
		const r = next(args);
		if (how) safely(() => denyHit(how));
		return r;
	});

	// ---------- formatting ----------
	function fmtSpan(ms) {
		const s = Math.max(0, Math.floor(ms / 1000));
		const d = Math.floor(s / 86400);
		const hh = Math.floor((s % 86400) / 3600);
		const mm = Math.floor((s % 3600) / 60);
		if (d) return `${d}d ${hh}h ${mm}m`;
		if (hh) return `${hh}h ${mm}m`;
		return `${mm}m ${s % 60}s`;
	}
	const fmtDay = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
	const fmtWhen = (t) => {
		const d = new Date(t);
		const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		return d.toDateString() === new Date().toDateString() ? time : `${fmtDay(t)} ${time}`;
	};
	function todayCounts() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const out = { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 };
		for (const e of log)
			if (e[0] >= start.getTime() && e[1] in out) {
				out[e[1]]++;
				if (e[3] === "failed") out.failed++;
			}
		return out;
	}
	const sinceText = () => fmtSpan(elapsed(state.streakStart));
	const allTime = (k) => state.totals[k] + (state.base[k] || 0);
	// The orgasm clock: { t, exact }. The
	// stretch starts at install until the first one (exact: false, shown as "≥").
	function sinceFor(k) {
		if (k === "orgasm") return { t: state.streakStart, exact: !!state.lastOrgasmAt };
		return state.last[k] ? { t: state.last[k], exact: true } : null;
	}
	const two = (span) => span.split(" ").slice(0, 2).join(" "); // the two largest units: "1d 2h", "4h 0m", "25m 3s"
	// The big text of a box. Orgasm: time since the last one. Denied / ruined: how long the item has been on you while
	// one is, otherwise how many this stretch. Resisted: how many this stretch.
	// short: the dock tab's summary line.
	function clockText(k, short = false) {
		if (k === "orgasm") {
			const x = sinceFor(k);
			return `${x.exact ? "" : "≥ "}${fmtSpan(elapsed(x.t))}${short ? " since last orgasm" : ""}`;
		}
		if (state.held[k]) {
			const span = two(fmtSpan(elapsed(state.held[k])));
			return short ? `${KINDS[k].icon} held ${span} · ${state.streak[k]} ${KINDS[k].label.toLowerCase()}` : span;
		}
		return short ? `${KINDS[k].icon} ${state.streak[k]} ${KINDS[k].label.toLowerCase()} this stretch` : String(state.streak[k]);
	}
	// The game's own lifetime count (Player.ArousalSettings.OrgasmCount, shown under its zoomed arousal meter)
	const gameCountText = () => {
		const n = Player.ArousalSettings?.OrgasmCount;
		// 0 usually just means the game hasn't kept a count for this character: not worth a line
		return Number.isFinite(n) && n > 0 ? `The game's own count: ${n} (under its arousal meter).` : "";
	};

	// ---------- panel ----------
	const ui = (() => {
		let panel = null;
		let root = null;
		const h = (tag, attrs = {}, ...kids) => {
			const el = document.createElement(tag);
			for (const [k, v] of Object.entries(attrs)) {
				if (k === "class") el.className = v;
				else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
				else if (v === true) el.setAttribute(k, "");
				else if (v !== false && v != null) el.setAttribute(k, v);
			}
			for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
			return el;
		};
		const CSS = `
#ag-body{font-size:12px}
#ag-body .ag-clock{padding:3px 5px;border:1px solid var(--bcd-line-soft,#352f42);border-radius:5px;cursor:pointer;min-width:0}
#ag-body .ag-clock.pin{border-color:var(--bcd-hi,#9a5cc8);box-shadow:0 0 0 1px var(--bcd-hi,#9a5cc8) inset}
#ag-body .ag-clock .ag-t{font-weight:700;font-variant-numeric:tabular-nums;color:var(--bcd-accent,#e7b6ff);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ag-body .ag-clock.big .ag-t{font-size:20px}
#ag-body .ag-clock.on{border-color:#c86a5c}
#ag-body .ag-clock.on .ag-t{color:#ffb3a6}
#ag-body .ag-clock .ag-k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ag-body .ag-clock:not(.big) .ag-k{letter-spacing:0;text-transform:none;font-size:10px}
#ag-body .ag-clock:not(.big){padding:2px 4px}
#ag-body .ag-clock:not(.big) .ag-sub{font-size:10px;margin:0}
#ag-body .ag-clocks{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:4px 0}
#ag-body .ag-k{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--bcd-muted,#a99fc0)}
#ag-body .ag-sub{color:#aaa;font-size:11px;margin:1px 0 4px}
#ag-body .ag-rec{margin:4px 0;padding:4px 6px;border-radius:5px;background:var(--bcd-ctl,#24202c);font-size:11px}
#ag-body .ag-rec.new{background:var(--bcd-tab-act,#3b2350);border:1px solid var(--bcd-hi,#9a5cc8);color:#fff}
#ag-body table{width:100%;border-collapse:collapse;margin:4px 0;font-variant-numeric:tabular-nums}
#ag-body th,#ag-body td{padding:2px 3px;text-align:right;font-weight:400}
#ag-body th{color:var(--bcd-muted,#a99fc0);font-size:10px;text-transform:uppercase}
#ag-body td:first-child,#ag-body th:first-child{text-align:left}
#ag-body tr+tr td{border-top:1px solid var(--bcd-line-soft,#2f2a3a)}
#ag-body details{margin:4px 0}
#ag-body summary{cursor:pointer;color:var(--bcd-muted,#a99fc0);font-size:11px}
#ag-body .ag-log{max-height:180px;overflow-y:auto;font-size:11px}
#ag-body .ag-log div{padding:1px 0}
#ag-body .ag-log .ag-away{color:#888;font-style:italic}
#ag-body .hint{color:#999;font-size:11px;margin:3px 0}
#ag-body .hint:empty{display:none}
#ag-body button{font:inherit}
#ag-body input{font:inherit;color:#eee;background:var(--bcd-ctl,#2a2633);border:1px solid var(--bcd-ctl-line,#5a5070);border-radius:5px;padding:1px 3px;box-sizing:border-box}
#ag-body .ag-start{margin:6px 0;padding:4px 6px;border:1px solid var(--bcd-line-soft,#352f42);border-radius:5px}
#ag-body .ag-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 6px;margin:3px 0}
#ag-body .ag-grid label{display:flex;justify-content:space-between;align-items:center;gap:4px;font-size:11px}
#ag-body .ag-row{display:flex;align-items:center;gap:4px;margin:3px 0;font-size:11px;flex-wrap:wrap}
`;
		function mount() {
			if (panel) return;
			if (!window.BCDock) return console.warn(TAG, "bc-dock.js isn't loaded (add its @require to the loader), so there's no panel");
			document.head.append(h("style", { id: "ag-style" }, CSS));
			panel = BCDock.add({ id: "afterglow", title: "Afterglow", icon: "✨", order: 40, version: MOD_INFO.version, width: 220, minWidth: 190, maxWidth: 300, alignStart: true, onToggle: () => render() });
			root = panel.body;
			root.id = "ag-body";
			render();
		}
		function unmount() {
			panel?.remove();
			document.getElementById("ag-style")?.remove();
			panel = root = null;
		}

		function render() {
			if (!panel) return;
			const on = !!Player.MemberNumber && loadedFor === Player.MemberNumber;
			panel.setVisible(on);
			if (!on) return;
			panel.setSummary(clockText(state.show, true));
			if (!panel.isOpen()) return root.replaceChildren();
			const now = Date.now();
			const cur = elapsed(state.streakStart);
			const g = recGap();
			const beating = !g || cur > g.ms;
			const today = todayCounts();
			const arousalOff = Player.ArousalSettings && Player.ArousalSettings.Active === "Inactive";
			const parts = [
				arousalOff ? h("div", { class: "hint" }, "Your arousal is turned off in the game's settings, so there's nothing to count.") : null,
				clockCell("orgasm"),
				h(
					"div",
					{ class: `ag-rec${beating && g ? " new" : ""}`, "data-ag": "rec" },
					g
						? beating
							? `🏆 Longest yet: you've passed your record of ${fmtSpan(g.ms)}${state.timeMode === "online" ? " online" : ""}`
							: `🏆 Longest without${state.timeMode === "online" ? " (online)" : ""}: ${g.exact ? "" : "≥ "}${fmtSpan(g.ms)} ${g.manual ? "(entered by hand)" : `(${fmtDay(g.from)} → ${fmtDay(g.to)})`}`
						: "🏆 Your longest stretch shows here after your first orgasm."
				),
				h("div", { class: "ag-clocks" }, STREAK_KEYS.map(clockCell)),
				h(
					"table",
					{},
					h("tr", {}, h("th", {}, ""), h("th", {}, "Session"), h("th", {}, "Today"), h("th", {}, "All")),
					KIND_KEYS.map((k) => h("tr", {}, h("td", {}, `${KINDS[k].icon} ${KINDS[k].label}`), h("td", {}, session[k]), h("td", {}, today[k]), h("td", { title: state.base[k] ? `${state.totals[k]} counted + ${state.base[k]} from before` : null }, allTime(k))))
				),
				h("div", { class: "hint", "data-ag": "game", title: "The number under the game's arousal meter when you zoom in on it. The game saves it when you leave its Preferences screen and with arousal updates in chat rooms, so it can lag behind or start at 0." }, gameCountText()),
				h(
					"details",
					{ ontoggle: (e) => (openLog = e.target.open), open: openLog },
					h("summary", {}, `Recent (${log.length})`),
					h(
						"div",
						{ class: "ag-log" },
						log.length
							? log
									.slice(-50)
									.reverse()
									.map((e) =>
										e[1] === "away"
											? h("div", { class: "ag-away" }, `${fmtWhen(e[0])} ⏸ Away ${fmtSpan(e[3])}`)
											: h("div", {}, `${fmtWhen(e[0])} ${KINDS[e[1]].icon} ${KINDS[e[1]].one}${e[3] === "edge" ? " (edged)" : e[3] === "failed" ? ` (${KINDS.failed.icon} resist failed)` : ""}${e[2] ? ` in ${e[2]}` : ""}`)
									)
							: h("div", { class: "hint" }, "Nothing yet.")
					)
				),
				h(
					"details",
					{ ontoggle: (e) => (openMore = e.target.open), open: openMore },
					h("summary", {}, "More"),
					h("div", { class: "hint" }, `Counting since ${fmtWhen(state.since)}. Counts and records go with your account; the recent list stays in this browser.`),
					h("div", { class: "hint" }, "Denied: held at the edge by a denial or edging effect. A spell at the edge counts once (again after a minute's break, or after arousal drops)."),
				h("div", { class: "hint" }, "😵 Resist failed: you started resisting but the time ran out and you came. It's counted as an orgasm too."),
				h("div", { class: "hint" }, "⛔ and 💔 show a timer while a denial (or edging) or ruin item is on you: how long it's been on. Otherwise they and ✊ count how many since your last orgasm."),
					h(
						"label",
						{ class: "ag-row", title: "Time away: logged out, the game closed, or disconnected (noticed at your next login, to within a minute)" },
						"Clocks count",
						h(
							"select",
							{ onchange: (e) => ((state.timeMode = e.target.value === "online" ? "online" : "real"), save(), render()) },
							h("option", { value: "real", selected: state.timeMode === "real" }, "all time"),
							h("option", { value: "online", selected: state.timeMode === "online" }, "only time online")
						)
					),
					h("div", { class: "hint" }, "Time away (logged out, game closed, disconnected) is noticed at your next login and listed in Recent as ⏸. It's tracked from this version on."),
					startForm(),
					h("button", { title: "Start counting again from zero", onclick: resetAll }, "Reset everything")
				),
			];
			root.replaceChildren(...parts.filter(Boolean));
		}
		let openLog = false;
		let openMore = false;
		// The other way of counting, when it differs by more than a minute: "1d 4h online" or "2d 3h in all"
		function otherTime(t) {
			const away = awayBetween(t, Date.now());
			if (away < 60_000) return "";
			return state.timeMode === "online" ? `${fmtSpan(elapsed(t, "real"))} in all` : `${fmtSpan(elapsed(t, "online"))} online`;
		}
		// One box. The big one: time since the last orgasm. The small ones (denied, ruined, resisted): how many since
		// your last orgasm, with the record; denied and ruined turn into a timer while such an item is on you.
		// Clicking a box shows it on the dock tab's summary (📌).
		function clockCell(k) {
			const big = k === "orgasm";
			const pinned = k === state.show;
			const held = !big && state.held[k];
			const x = big ? sinceFor(k) : null;
			const other = big ? otherTime(x.t) : "";
			const lastTxt = state.last[k] ? `last ${fmtWhen(state.last[k])}` : `none yet`;
			const sub = big
				? (state.lastOrgasmAt ? `Last one ${fmtWhen(state.lastOrgasmAt)}` : `None seen since Afterglow started counting (${fmtWhen(state.since)})`) + (other ? ` · ${other}` : "")
				: held
					? `${state.streak[k]} now · rec ${state.rec[k]}`
					: k === "resisted"
						? `rec ${state.rec[k]} · ${KINDS.failed.icon} ${allTime("failed")}`
						: `rec ${state.rec[k]}`;
			const what = { denied: "a denial or edging item", ruined: "a ruin item" }[k];
			const title = big
				? `Time since your last orgasm${state.timeMode === "online" ? ", online" : ""}${other ? `; ${other}` : ""}.`
				: held
					? `${what[0].toUpperCase()}${what.slice(1)} has been on you since ${fmtWhen(state.held[k])}. ${state.streak[k]} ${KINDS[k].label.toLowerCase()} since your last orgasm (${lastTxt}); the most in one stretch: ${state.rec[k]}.`
					: `${KINDS[k].label} since your last orgasm (${lastTxt}); the most in one stretch: ${state.rec[k]}.${what ? ` While ${what} is on you, this shows how long it's been on.` : ""}${k === "resisted" ? ` ${KINDS.failed.icon} ${allTime("failed")} times you tried to resist and came anyway (all time).` : ""}`;
			return h(
				"div",
				{
					class: `ag-clock${big ? " big" : ""}${pinned ? " pin" : ""}${held ? " on" : ""}`,
					title: `${title}${pinned ? " Shown on the dock tab." : " Click to show it on the dock tab."}`,
					onclick: () => ((state.show = k), save(), render()),
				},
				h("div", { class: "ag-k" }, big ? `${KINDS[k].icon} Since last orgasm${pinned ? " 📌" : ""}` : `${KINDS[k].icon} ${held ? "Held" : KINDS[k].label}${pinned ? " 📌" : ""}`),
				h("div", { class: "ag-t", "data-ag-clock": k }, clockText(k)),
				h("div", { class: "ag-sub" }, sub)
			);
		}

		// "From before Afterglow": earlier totals, when the last orgasm was, and the longest stretch so far
		const toInput = (t) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
		function startForm() {
			const num = (v, title) => h("input", { type: "number", min: 0, step: 1, value: v || 0, title, style: "width:4.2em" });
			const totals = KIND_KEYS.map((k) => [k, num(state.base[k], `${KINDS[k].label} before Afterglow started counting`)]);
			const last = h("input", { type: "datetime-local", value: state.lastOrgasmAt ? toInput(state.lastOrgasmAt) : "", max: toInput(Date.now()), style: "width:100%" });
			const g = state.rec.gap?.manual ? state.rec.gap.ms : 0;
			const recD = num(Math.floor(g / 86_400_000), "Days");
			const recH = num(Math.floor((g % 86_400_000) / 3_600_000), "Hours");
			const note = h("div", { class: "hint" });
			const apply = () => {
				const int = (el) => Math.max(0, Math.min(1e6, Math.round(Number(el.value) || 0)));
				for (const [k, el] of totals) state.base[k] = int(el);
				if (last.value) {
					const t = new Date(last.value).getTime();
					if (!Number.isFinite(t) || t > Date.now()) return (note.textContent = "That time is in the future.");
					// Afterglow saw one after that: its own record wins
					if (state.lastOrgasmAt && t < state.lastOrgasmAt - 60_000) return (note.textContent = `Afterglow saw one later than that (${fmtWhen(state.lastOrgasmAt)}).`);
					state.lastOrgasmAt = t;
					state.streakStart = t;
				}
				const ms = int(recD) * 86_400_000 + int(recH) * 3_600_000;
				for (const key of ["gap", "gapOnline"]) {
					const cur = state.rec[key];
					if (ms > 0 && (!cur || cur.manual || ms > cur.ms)) state.rec[key] = { ms, from: 0, to: 0, exact: true, manual: true };
					else if (!ms && cur?.manual) state.rec[key] = null;
				}
				save();
				render();
			};
			return h(
				"div",
				{ class: "ag-start" },
				h("div", { class: "ag-k" }, "From before Afterglow"),
				h("div", { class: "ag-grid" }, totals.map(([k, el]) => h("label", { title: el.title }, `${KINDS[k].icon} ${KINDS[k].label}`, el))),
				h("label", { class: "ag-row" }, "Last orgasm", last),
				h("label", { class: "ag-row", title: "Your longest stretch without an orgasm before Afterglow. A longer one Afterglow sees replaces it." }, "Longest without", recD, "d", recH, "h"),
				h("div", { class: "ag-row" }, h("button", { title: "Save these", onclick: apply }, "Save"), note),
				h("div", { class: "hint" }, "Totals here are added to the All column. Leave the last orgasm empty if you don't know it.")
			);
		}

		// Once a second: the running clocks
		function tick() {
			if (!panel || !(Player.MemberNumber && loadedFor === Player.MemberNumber)) return;
			panel.setSummary(clockText(state.show, true));
			for (const el of root?.querySelectorAll("[data-ag-clock]") || []) {
				const t = clockText(el.dataset.agClock);
				if (el.textContent !== t) el.textContent = t;
			}
			const gc = root?.querySelector('[data-ag="game"]');
			if (gc && gc.textContent !== gameCountText()) gc.textContent = gameCountText();
			// Passing the record redraws the record line
			const g = recGap();
			const rec = root?.querySelector('[data-ag="rec"]');
			if (rec && g && elapsed(state.streakStart) > g.ms && !rec.classList.contains("new")) render();
		}
		return { mount, unmount, render, tick, open: () => (panel?.open(), render()) };
	})();

	function resetAll() {
		if (!window.confirm("Reset every Afterglow count, record and the recent list on this account? This can't be undone.")) return;
		state = fresh();
		session = { orgasm: 0, ruined: 0, resisted: 0, failed: 0, denied: 0 };
		log = [];
		writeLog();
		save();
		ui.render();
	}

	// ---------- /afterglow ----------
	function statsLine() {
		const g = recGap();
		return (
			`✨ ${state.lastOrgasmAt ? "" : "≥ "}${sinceText()}${state.timeMode === "online" ? " online" : ""} since last orgasm` +
			` · this stretch: ${state.streak.denied} denied, ${state.streak.ruined} ruined, ${state.streak.resisted} resisted` +
			(g ? ` · longest: ${g.exact ? "" : "≥ "}${fmtSpan(g.ms)}` : "") +
			` · all: ${allTime("orgasm")} orgasms, ${allTime("denied")} denied, ${allTime("resisted")} resisted, ${allTime("failed")} failed resists`
		);
	}
	const COMMAND = {
		Tag: "afterglow",
		Description: ": Afterglow: open the panel, or 'stats' for a summary only you see",
		Action: (args) => {
			if (String(args || "").trim().toLowerCase() === "stats") {
				if (typeof ChatRoomSendLocal === "function") ChatRoomSendLocal(statsLine(), 30_000);
				return;
			}
			ui.open();
		},
	};
	let commandAdded = false;
	function addCommand() {
		if (commandAdded || typeof Commands === "undefined" || typeof CommandCombine !== "function") return;
		commandAdded = true;
		if (Commands.some((c) => c.Tag === COMMAND.Tag)) return console.warn(TAG, "/afterglow is already used by another add-on");
		CommandCombine([COMMAND]);
	}

	// ---------- wiring ----------
	ui.mount();
	const tickTimer = setInterval(() => {
		addCommand();
		if (Player.MemberNumber && loadedFor !== Player.MemberNumber) {
			loadedFor = Player.MemberNumber;
			load();
			ui.render();
		} else if (!Player.MemberNumber && loadedFor) {
			loadedFor = null;
			ui.render();
		}
		if ((Player.ArousalSettings?.Progress ?? 0) < DENY_DROP) dropped = true;
		safely(checkHeld);
		if (loadedFor && Player.MemberNumber === loadedFor && connected()) {
			// Back after a disconnect, or the computer slept, without a new login: that silence was time away too
			if (aliveAt && Date.now() - aliveAt > AWAY_MIN_MS + ALIVE_EVERY_MS) {
				addAway(aliveAt, Date.now());
				markAlive(true);
				ui.render();
			} else markAlive();
		}
		ui.tick();
	}, 1000);

	window.Afterglow = {
		version: MOD_INFO.version,
		state: () => state,
		session: () => ({ ...session }),
		log: () => [...log],
		stats: statsLine,
		unload() {
			clearInterval(tickTimer);
			clearTimeout(saveTimer);
			ui.unmount();
			mod.unload();
			delete window.Afterglow;
		},
	};

	console.log(TAG, `v${MOD_INFO.version} loaded`);
})();
