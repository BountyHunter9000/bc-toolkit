// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 BountyHunter9000. Part of BC Toolkit: https://github.com/BountyHunter9000/bc-toolkit
// Refreshes the version lists in toolkit.json from the release tags (book-v1.2.3, qa-v0.5.2, …), newest first.
// Run it after tagging a release, then commit toolkit.json:   node tools/toolkit-list.mjs
// The BC Toolkit loader (in the dock) reads toolkit.json from main to fill its version dropdowns; the add-on files
// themselves always come from their tags.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KEEP = 8; // versions offered per add-on
const file = fileURLToPath(new URL("../toolkit.json", import.meta.url));
const list = JSON.parse(readFileSync(file, "utf8"));
const tags = execFileSync("git", ["tag", "-l"], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const cmp = (a, b) => {
	const x = a.split(".").map(Number);
	const y = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
	return 0;
};
for (const a of list.addons) {
	const vs = tags.filter((t) => t.startsWith(a.prefix)).map((t) => t.slice(a.prefix.length)).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
	a.versions = vs.sort(cmp).slice(0, KEEP);
	console.log(`${a.name}: ${a.versions.join(", ") || "(no releases)"}`);
}
writeFileSync(file, JSON.stringify(list, null, 2) + "\n");
