/*
 * Output formats for Export as Table. Each format turns column headers and
 * rows of cell text into a file's contents. To add a format, add an entry to
 * FORMATS and a label for it to the locale file.
 *
 * This file has no Zotero dependencies, so the test script can check the output.
 */

var ExportFormats = (function () {
	"use strict";

	/** One line, with pipes and backslashes escaped so they can't split the cell. */
	function markdownCell(value) {
		return String(value ?? "")
			.replace(/\s*[\r\n]+\s*/g, " ")
			.trim()
			.replace(/\\/g, "\\\\")
			.replace(/\|/g, "\\|");
	}

	/**
	 * A GitHub-flavoured Markdown table.
	 * @param {{label: string, align: "start"|"end"}[]} columns
	 * @param {string[][]} rows - One array of cell text per item, in column order.
	 */
	function markdownTable(columns, rows) {
		const line = (cells) => `| ${cells.join(" | ")} |`;
		return [
			line(columns.map((column) => markdownCell(column.label))),
			line(columns.map((column) => (column.align === "end" ? "---:" : "---"))),
			...rows.map((row) => line(row.map(markdownCell))),
		].join("\n") + "\n";
	}

	const FORMATS = [
		{
			id: "markdown",
			l10nID: "extra-columns-export-format-markdown",
			extension: "md",
			serialize: markdownTable,
		},
	];

	function list() {
		return FORMATS.slice();
	}

	/** The format with this id, or the first format when there is none. */
	function get(id) {
		return FORMATS.find((format) => format.id === id) || FORMATS[0];
	}

	return { list, get, markdownCell };
})();
