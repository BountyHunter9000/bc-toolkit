// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// BC Toolkit (beta) without Tampermonkey: the same thing bc-toolkit-beta.user.js does (test versions switched on), for the browser console, a bookmark, or an
// add-on manager such as FUSAM. It turns the loader on and adds the dock; the dock then loads the add-ons you have
// switched on (⚙ → Add-ons). Running it twice, or alongside the Tampermonkey script, does nothing more.
// Which dock release to add comes from toolkit.json on GitHub (updated within minutes of a release), so this file
// itself hardly ever changes, and a CDN holding on to an old copy of it doesn't hold anyone back. If the list can't be
// read, the release named below is used.
(() => {
	"use strict";
	const BETA = true; // loader.js: false. Test versions switched on, and the dock's newest test version
	const FALLBACK = "tk-v1.3.0";
	const LISTS = ["https://raw.githubusercontent.com/BountyHunter9000/bc-toolkit/main/toolkit.json", "https://cdn.jsdelivr.net/gh/BountyHunter9000/bc-toolkit@main/toolkit.json"];
	const dockUrl = (tag) => `https://cdn.jsdelivr.net/gh/BountyHunter9000/bc-toolkit@${tag}/bc-dock/bc-dock.js`;
	if (window.BCToolkit && window.BCToolkit.loader === true) return;
	window.BCToolkit = BETA ? { loader: true, beta: true } : { loader: true };

	async function dockTag() {
		for (const url of LISTS) {
			try {
				const ctl = new AbortController();
				const timer = setTimeout(() => ctl.abort(), 6000);
				const r = await fetch(url, { cache: "no-store", signal: ctl.signal }).finally(() => clearTimeout(timer));
				if (!r.ok) continue;
				const list = await r.json();
				const tag = BETA ? list.dockBeta || list.dock : list.dock;
				// Only a dock tag of this repository, nothing else the list might say
				if (typeof tag === "string" && /^tk-v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) return tag;
			} catch {}
		}
		return FALLBACK;
	}

	// Added even when a dock is already here (from an old one-add-on script): the newer copy takes over, the same or an
	// older one steps aside, and a dock from version 14 on starts the loader once it sees the flag above
	dockTag().then((tag) => {
		const s = document.createElement("script");
		s.src = dockUrl(tag);
		s.crossOrigin = "anonymous";
		s.onerror = () => console.warn("[BC Toolkit] couldn't download the dock from", s.src);
		document.head.append(s);
	});
})();
