/*
 * Field definitions, stored as JSON in a local Zotero preference.
 *
 * A definition looks like:
 *   { "id": "k3j9x2Ab", "label": "Reading status", "key": "Reading Status", "type": "text" }
 * The id never changes, so column widths and visibility survive renames.
 */

/* global Zotero, ExtraFields */

var FieldConfig = (function () {
	"use strict";

	const PREF = "extensions.extra-columns.fields";
	const TYPES = ["text", "number"];

	/** Read definitions, dropping malformed or duplicate entries. */
	function load() {
		let parsed;
		try {
			parsed = JSON.parse(Zotero.Prefs.get(PREF, true) || "[]");
		}
		catch (e) {
			Zotero.logError(new Error(`Extra Columns: ${PREF} is not valid JSON`));
			return [];
		}
		if (!Array.isArray(parsed)) {
			return [];
		}

		const fields = [];
		const seenIDs = new Set();
		const seenKeys = new Set();
		for (const entry of parsed) {
			if (!entry || typeof entry !== "object") {
				continue;
			}
			const field = {
				id: String(entry.id ?? ""),
				label: String(entry.label ?? "").trim(),
				key: String(entry.key ?? "").trim(),
				type: TYPES.includes(entry.type) ? entry.type : "text",
			};
			if (!field.id || seenIDs.has(field.id) || !ExtraFields.isValidKeySyntax(field.key)) {
				continue;
			}
			const normalized = ExtraFields.normalizeKey(field.key);
			if (seenKeys.has(normalized)) {
				continue;
			}
			if (!field.label) {
				field.label = field.key;
			}
			seenIDs.add(field.id);
			seenKeys.add(normalized);
			fields.push(field);
		}
		return fields;
	}

	function save(fields) {
		const clean = fields.map(({ id, label, key, type }) => ({ id, label, key, type }));
		Zotero.Prefs.set(PREF, JSON.stringify(clean), true);
	}

	/**
	 * True when Zotero would read "key: value" in Extra as one of its own fields,
	 * CSL variables or creator types. Such a line would be captured by Zotero,
	 * or moved into a real field when Zotero's schema is updated.
	 */
	function isReservedKey(key) {
		if (ExtraFields.normalizeKey(key) === "type") {
			return true;
		}
		try {
			const result = Zotero.Utilities.Internal.extractExtraFields(`${key}: x`);
			return result.extra.trim() === "";
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
	}

	/**
	 * Check a key for a new field. Returns null when it is usable, or the
	 * Fluent message ID and arguments that explain the problem.
	 */
	function validateNewKey(fields, key) {
		if (!ExtraFields.isValidKeySyntax(key)) {
			return { l10nID: "extra-columns-error-key-syntax" };
		}
		const normalized = ExtraFields.normalizeKey(key);
		if (fields.some((field) => ExtraFields.normalizeKey(field.key) === normalized)) {
			return { l10nID: "extra-columns-error-key-duplicate", args: { key } };
		}
		if (isReservedKey(key)) {
			return { l10nID: "extra-columns-error-key-reserved", args: { key } };
		}
		return null;
	}

	function newID(fields) {
		const used = new Set(fields.map((field) => field.id));
		let id;
		do {
			id = Zotero.Utilities.randomString(8);
		} while (used.has(id));
		return id;
	}

	function createField(fields, { label, key, type }) {
		return {
			id: newID(fields),
			label: String(label ?? "").trim() || key,
			key,
			type: TYPES.includes(type) ? type : "text",
		};
	}

	return { PREF, TYPES, load, save, isReservedKey, validateNewKey, createField };
})();
