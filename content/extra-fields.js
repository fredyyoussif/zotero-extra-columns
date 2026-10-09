/*
 * Pure helpers for reading and writing "Key: value" lines in Zotero's Extra field.
 *
 * This file has no Zotero dependencies. The plugin loads it with loadSubScript,
 * and the test script reaches it through Zotero.ExtraColumns.ExtraFields.
 */

var ExtraFields = (function () {
	"use strict";

	// A custom key starts with a letter, like the keys Zotero itself reads from Extra.
	const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9 ._-]*$/;
	// "Key: value". The value part may contain anything, including colons and "\r".
	const LINE_PATTERN = /^([A-Za-z][A-Za-z0-9 ._-]*):([\s\S]*)$/;
	const NUMBER_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/;

	const MAX_INT_DIGITS = 15;
	const MAX_FRAC_DIGITS = 10;
	// Separates a number column's sort key from the value shown in the cell.
	const SEPARATOR = "|";

	/**
	 * Normalise a key the same way Zotero does for Extra lines,
	 * so "readingStatus", "Reading Status" and "reading_status" all match.
	 */
	function normalizeKey(key) {
		return String(key)
			.trim()
			.replace(/([a-z])([A-Z])/g, "$1-$2")
			.toLowerCase()
			.replace(/[\s_-]/g, "-");
	}

	function isValidKeySyntax(key) {
		return typeof key === "string" && key === key.trim() && KEY_PATTERN.test(key);
	}

	/** Derive a usable Extra key from a column name, or "" if none can be made. */
	function suggestKeyFromLabel(label) {
		const cleaned = String(label ?? "")
			.replace(/[^A-Za-z0-9 ._-]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return isValidKeySyntax(cleaned) ? cleaned : "";
	}

	/** Values live on one Extra line, so line breaks become spaces. */
	function sanitizeValue(value) {
		return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
	}

	/** Parse one Extra line. Returns null when the line is not "Key: value". */
	function parseLine(line) {
		const match = LINE_PATTERN.exec(line);
		if (!match) {
			return null;
		}
		const key = match[1].trim();
		return { key, normalizedKey: normalizeKey(key), value: sanitizeValue(match[2]) };
	}

	/** All "Key: value" lines with a non-empty value, in order. */
	function parseExtra(extra) {
		if (!extra) {
			return [];
		}
		const entries = [];
		for (const line of String(extra).split("\n")) {
			const parsed = parseLine(line);
			if (parsed && parsed.value !== "") {
				entries.push(parsed);
			}
		}
		return entries;
	}

	/** The first non-empty value for a key, as Zotero's own parser does. */
	function getValue(extra, key) {
		const target = normalizeKey(key);
		for (const entry of parseExtra(extra)) {
			if (entry.normalizedKey === target) {
				return entry.value;
			}
		}
		return "";
	}

	/**
	 * Return Extra with the key set to value. Every existing line for the key is
	 * removed and the new line goes where the first one was, or at the end.
	 * All other lines are kept exactly. An empty value removes the key.
	 */
	function setValue(extra, key, value) {
		const target = normalizeKey(key);
		const lines = extra ? String(extra).split("\n") : [];
		const kept = [];
		let insertAt = -1;

		for (const line of lines) {
			const parsed = parseLine(line);
			if (parsed && parsed.normalizedKey === target) {
				if (insertAt === -1) {
					insertAt = kept.length;
				}
				continue;
			}
			kept.push(line);
		}

		const clean = sanitizeValue(value);
		if (clean !== "") {
			if (insertAt === -1) {
				// Append before any trailing blank lines so a final newline is kept.
				insertAt = kept.length;
				while (insertAt > 0 && kept[insertAt - 1] === "") {
					insertAt--;
				}
			}
			kept.splice(insertAt, 0, `${key}: ${clean}`);
		}
		return kept.join("\n");
	}

	/**
	 * Canonical form of a number: no "+", no leading zeros, no trailing fraction
	 * zeros, and "0" instead of "-0". Returns null for anything that isn't a
	 * plain decimal number within the supported size.
	 */
	function canonicalNumber(raw) {
		const text = sanitizeValue(raw);
		const match = NUMBER_PATTERN.exec(text);
		if (!match) {
			return null;
		}
		const sign = match[1] || "";
		let intPart = match[2] || "";
		let fracPart = match[3] || "";
		if (intPart === "" && fracPart === "") {
			return null;
		}
		intPart = intPart.replace(/^0+/, "");
		fracPart = fracPart.replace(/0+$/, "");
		if (intPart.length > MAX_INT_DIGITS || fracPart.length > MAX_FRAC_DIGITS) {
			return null;
		}
		if (intPart === "") {
			intPart = "0";
		}
		const isZero = intPart === "0" && fracPart === "";
		const negative = sign === "-" && !isZero;
		return (negative ? "-" : "") + intPart + (fracPart ? "." + fracPart : "");
	}

	function isNumber(raw) {
		return canonicalNumber(raw) !== null;
	}

	/**
	 * Sort key for a number column. Fixed-width digits make plain and natural
	 * (numeric) collation give the same order:
	 *   ""            empty value, which Zotero sorts last
	 *   "a" + digits  negative numbers, digits complemented so -2 sorts before -1
	 *   "b" + digits  zero and positive numbers
	 *   "c"           text that isn't a number, after all numbers
	 * The raw value follows the separator so the cell can show it unchanged.
	 */
	function numberSortKey(raw) {
		const text = sanitizeValue(raw);
		if (text === "") {
			return "";
		}
		const canonical = canonicalNumber(text);
		if (canonical === null) {
			return "c" + SEPARATOR + text;
		}
		const negative = canonical.startsWith("-");
		const [intPart, fracPart = ""] = canonical.replace("-", "").split(".");
		let digits = intPart.padStart(MAX_INT_DIGITS, "0") + fracPart.padEnd(MAX_FRAC_DIGITS, "0");
		if (negative) {
			digits = digits.replace(/\d/g, (d) => String(9 - Number(d)));
		}
		return (negative ? "a" : "b") + digits + SEPARATOR + text;
	}

	/** The value to display from a number column's sort key. */
	function displayFromSortKey(sortKey) {
		const key = String(sortKey ?? "");
		const index = key.indexOf(SEPARATOR);
		return index === -1 ? key : key.slice(index + 1);
	}

	return {
		KEY_PATTERN,
		MAX_INT_DIGITS,
		MAX_FRAC_DIGITS,
		SEPARATOR,
		normalizeKey,
		isValidKeySyntax,
		suggestKeyFromLabel,
		sanitizeValue,
		parseLine,
		parseExtra,
		getValue,
		setValue,
		canonicalNumber,
		isNumber,
		numberSortKey,
		displayFromSortKey,
	};
})();

if (typeof module !== "undefined" && module.exports) {
	module.exports = ExtraFields;
}
