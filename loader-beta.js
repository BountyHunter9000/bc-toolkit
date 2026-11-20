// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// BC Toolkit (beta) without Tampermonkey: the same thing bc-toolkit-beta.user.js does (test versions switched on), for the browser console, a bookmark, or an
// add-on manager such as FUSAM. It turns the loader on and adds the dock from its release; the dock then loads the
// add-ons you have switched on (⚙ → Add-ons). Running it twice, or alongside the Tampermonkey script, does nothing more.
(() => {
	"use strict";
	const DOCK = "https://cdn.jsdelivr.net/gh/BountyHunter9000/bc-toolkit@tk-v1.2.1/bc-dock/bc-dock.js";
	if (window.BCToolkit && window.BCToolkit.loader === true) return;
	window.BCToolkit = { loader: true, beta: true };
	// Added even when a dock is already here (from an old one-add-on script): the newer copy takes over, the same or an
	// older one steps aside, and a dock from version 14 on starts the loader once it sees the flag above
	const s = document.createElement("script");
	s.src = DOCK;
	s.crossOrigin = "anonymous";
	s.onerror = () => console.warn("[BC Toolkit] couldn't download the dock from", DOCK);
	document.head.append(s);
})();
