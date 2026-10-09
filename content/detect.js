/*
 * Find "Key: value" lines already in Extra that could become custom fields.
 * Used to set up the same fields on another computer after sync.
 */

/* global Zotero, ExtraFields, FieldConfig */

var Detect = (function () {
	"use strict";

	const MAX_RESULTS = 100;

	/**
	 * Resolves to [{ key, count, sample, suggestedType }], most used first.
	 * Skips keys Zotero uses itself, keys already defined, and items in the trash.
	 */
	async function findCandidates(existingFields) {
		const values = await Zotero.DB.columnQueryAsync(
			"SELECT value FROM itemData JOIN itemDataValues USING (valueID) "
				+ "WHERE fieldID=? AND itemID NOT IN (SELECT itemID FROM deletedItems)",
			[Zotero.ItemFields.getID("extra")]
		);

		const defined = new Set(existingFields.map((field) => ExtraFields.normalizeKey(field.key)));
		const reserved = new Map();
		const found = new Map();

		for (const extra of values || []) {
			const seenInItem = new Set();
			for (const entry of ExtraFields.parseExtra(String(extra))) {
				const normalized = entry.normalizedKey;
				if (defined.has(normalized) || seenInItem.has(normalized)) {
					continue;
				}
				seenInItem.add(normalized);

				if (!reserved.has(normalized)) {
					reserved.set(normalized, FieldConfig.isReservedKey(entry.key));
				}
				if (reserved.get(normalized)) {
					continue;
				}

				let candidate = found.get(normalized);
				if (!candidate) {
					candidate = { key: entry.key, count: 0, sample: entry.value, allNumbers: true };
					found.set(normalized, candidate);
				}
				candidate.count++;
				if (!ExtraFields.isNumber(entry.value)) {
					candidate.allNumbers = false;
				}
			}
		}

		return [...found.values()]
			.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
			.slice(0, MAX_RESULTS)
			.map(({ key, count, sample, allNumbers }) => ({
				key,
				count,
				sample,
				suggestedType: allNumbers ? "number" : "text",
			}));
	}

	return { findCandidates };
})();
