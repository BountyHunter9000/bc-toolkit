// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// Vibe Fix for Bondage Club
// In R134, a vibrator's intensity can only go up: picking Off, or a lower level, changes the mode's name but leaves
// the vibrator running at the highest level it reached. This puts the intensity you picked in place.
//
// Why it happens: vibrators keep a default intensity (-1, off) in their item data. When the mode changes, the game
// leaves the previous intensity out of what it removes, because it's one of those defaults (ExtendedItemSetOption),
// then merges old and new intensity by taking the larger one (the Intensity property's merge rule). So the old,
// higher value always wins. The fix clears the old intensity just before the game applies the new one, so the new one
// replaces it. Nothing else about the change is touched, and it's still the game that sends it.
(async () => {
	"use strict";

	const MOD_INFO = { name: "VibeFix", fullName: "Vibe Fix", version: "0.1.0" };
	const TAG = "[VibeFix]";

	// Re-running the script (dev reload) replaces the previous instance
	if (window.VibeFix && typeof window.VibeFix.unload === "function") window.VibeFix.unload();

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	while (typeof bcModSdk === "undefined" || typeof ExtendedItemSetProperty === "undefined") await sleep(250);

	const mod = bcModSdk.registerMod(MOD_INFO);
	let fixed = 0;

	// ExtendedItemSetProperty(C, item, previousProperty, newProperty, push, refresh): removes previousProperty from the
	// item's properties, adds newProperty, and (with push) sends the item to the room. Only when the new properties set
	// an intensity, the item has a different one, and the previous properties don't mention it (the bug: it was left
	// out as a default) is the old intensity cleared first. When the game is fixed, previousProperty carries the
	// intensity again and this does nothing.
	mod.hookFunction("ExtendedItemSetProperty", 0, (args, next) => {
		try {
			const [, item, previous, next_] = args;
			const p = item?.Property;
			if (
				p &&
				typeof next_?.Intensity === "number" &&
				typeof p.Intensity === "number" &&
				p.Intensity !== next_.Intensity &&
				(previous == null || previous.Intensity === undefined)
			) {
				delete p.Intensity;
				fixed++;
			}
		} catch (e) {
			console.warn(TAG, e);
		}
		return next(args);
	});

	window.VibeFix = {
		version: MOD_INFO.version,
		fixed: () => fixed, // how many intensity changes it has put right since the page loaded
		unload() {
			mod.unload();
			delete window.VibeFix;
		},
	};

	console.log(TAG, `v${MOD_INFO.version} loaded${typeof GameVersion === "string" ? ` (game ${GameVersion})` : ""}`);
})();
