/*
 * Templates for combined columns in Export as Table, which put several fields
 * in one cell:
 *
 *   {name}     The value of a field.
 *   [ ... ]    An optional section. It's left out when a field directly inside
 *              it is empty, or when nothing inside it has a value.
 *   ][         Text between two sections, such as the "; " in
 *              "[D: {Disorder}]; [F: {Function}]", is only kept between
 *              sections that are shown.
 *   \{ \} \[ \] \\   The character itself.
 *
 * This file has no Zotero dependencies, so the test script can check it.
 */

var ExportTemplate = (function () {
	"use strict";

	const ESCAPABLE = "\\{}[]";

	/**
	 * Parse a template into nodes: {type: "text", text}, {type: "field", name}
	 * and {type: "section", children}.
	 * @returns {{nodes: object[], error: null} | {nodes: null, error: string}}
	 *   The error is a code: "unclosed-brace", "unexpected-brace",
	 *   "unclosed-bracket", "unexpected-bracket" or "empty-name".
	 */
	function parse(template) {
		const text = String(template ?? "");
		const root = [];
		const stack = [root];
		let buffer = "";
		const fail = (error) => ({ nodes: null, error });
		const flush = () => {
			if (buffer) {
				stack[stack.length - 1].push({ type: "text", text: buffer });
				buffer = "";
			}
		};

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (char === "\\" && ESCAPABLE.includes(text[i + 1] ?? "")) {
				buffer += text[++i];
			}
			else if (char === "{") {
				const end = text.indexOf("}", i + 1);
				const nextOpen = text.indexOf("{", i + 1);
				if (end < 0 || (nextOpen >= 0 && nextOpen < end)) {
					return fail("unclosed-brace");
				}
				const name = text.slice(i + 1, end).trim();
				if (!name) {
					return fail("empty-name");
				}
				flush();
				stack[stack.length - 1].push({ type: "field", name });
				i = end;
			}
			else if (char === "}") {
				return fail("unexpected-brace");
			}
			else if (char === "[") {
				flush();
				const section = { type: "section", children: [] };
				stack[stack.length - 1].push(section);
				stack.push(section.children);
			}
			else if (char === "]") {
				if (stack.length === 1) {
					return fail("unexpected-bracket");
				}
				flush();
				stack.pop();
			}
			else {
				buffer += char;
			}
		}
		if (stack.length > 1) {
			return fail("unclosed-bracket");
		}
		flush();
		return { nodes: root, error: null };
	}

	/** Every field name in the nodes, once each, in order. */
	function fieldNames(nodes) {
		const names = [];
		const visit = (list) => {
			for (const node of list) {
				if (node.type === "field" && !names.includes(node.name)) {
					names.push(node.name);
				}
				else if (node.type === "section") {
					visit(node.children);
				}
			}
		};
		visit(nodes || []);
		return names;
	}

	/**
	 * @param {object[]} nodes - From parse().
	 * @param {(name: string) => string} valueOf - A field's value, ready to insert.
	 * @param {(text: string) => string} [escape] - Applied to the template's own text.
	 */
	function render(nodes, valueOf, escape = (text) => text) {
		return renderSequence(nodes || [], valueOf, escape).text;
	}

	/** Returns the text, whether it holds a value, and whether a direct field is empty. */
	function renderSequence(nodes, valueOf, escape) {
		let text = "";
		let hasValue = false;
		let missing = false;
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			if (node.type === "text") {
				text += escape(node.text);
				continue;
			}
			if (node.type === "field") {
				const value = String(valueOf(node.name) ?? "");
				if (value.trim()) {
					text += value;
					hasValue = true;
				}
				else {
					missing = true;
				}
				continue;
			}

			// A run of sections with only text between them. The text before a
			// section is kept only when an earlier section in the run is shown.
			let shownBefore = false;
			let separator = "";
			let j = i;
			for (;;) {
				const section = renderSequence(nodes[j].children, valueOf, escape);
				if (section.hasValue && !section.missing) {
					if (shownBefore) {
						text += escape(separator);
					}
					text += section.text;
					shownBefore = true;
					hasValue = true;
				}
				const next = nodes[j + 1];
				if (next?.type === "section") {
					separator = "";
					j += 1;
				}
				else if (next?.type === "text" && nodes[j + 2]?.type === "section") {
					separator = next.text;
					j += 2;
				}
				else {
					break;
				}
			}
			i = j;
		}
		return { text, hasValue, missing };
	}

	/** Field names match ignoring case, spaces and punctuation. */
	function normalizeName(name) {
		return String(name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
	}

	return { parse, fieldNames, render, normalizeName };
})();
