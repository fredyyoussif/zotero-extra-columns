/*
 * Output formats for Export as Table. Each format turns column headers and
 * rows of cell text into a file's contents. To add a format, add an entry to
 * FORMATS and a label for it to the locale file.
 *
 * This file has no Zotero dependencies, so the test script can check the output.
 */

var ExportFormats = (function () {
	"use strict";

	/** Line breaks, for example in an abstract, become spaces. */
	function oneLine(value) {
		return String(value ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
	}

	/** One line, with pipes and backslashes escaped so they can't split the cell. */
	function markdownCell(value) {
		return oneLine(value)
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

	const LATEX_ESCAPES = {
		"\\": "\\textbackslash{}",
		"&": "\\&",
		"%": "\\%",
		"$": "\\$",
		"#": "\\#",
		"_": "\\_",
		"{": "\\{",
		"}": "\\}",
		"~": "\\textasciitilde{}",
		"^": "\\textasciicircum{}",
	};

	/** One line, with LaTeX's special characters escaped so they print as typed. */
	function latexCell(value) {
		return oneLine(value).replace(/[\\&%$#_{}~^]/g, (char) => LATEX_ESCAPES[char]);
	}

	/**
	 * A LaTeX tabular. Cells in a column marked `latex` are already LaTeX, such
	 * as \cite{key}, so they aren't escaped.
	 * @param {{label: string, align: "start"|"end", latex?: boolean}[]} columns
	 * @param {string[][]} rows - One array of cell text per item, in column order.
	 */
	function latexTable(columns, rows) {
		const line = (cells) => `${cells.join(" & ")} \\\\`;
		const spec = columns.map((column) => (column.align === "end" ? "r" : "l")).join("");
		return [
			`\\begin{tabular}{${spec}}`,
			"\\hline",
			line(columns.map((column) => latexCell(column.label))),
			"\\hline",
			...rows.map((row) => line(row.map((value, i) => (columns[i].latex ? oneLine(value) : latexCell(value))))),
			"\\hline",
			"\\end{tabular}",
		].join("\n") + "\n";
	}

	/** Quoted when it holds a comma, quote or line break, with quotes doubled. */
	function csvCell(value) {
		const text = String(value ?? "");
		return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
	}

	/**
	 * Comma-separated values (RFC 4180). Line breaks inside cells are kept.
	 * @param {{label: string}[]} columns
	 * @param {string[][]} rows - One array of cell text per item, in column order.
	 */
	function csvTable(columns, rows) {
		return [columns.map((column) => column.label), ...rows]
			.map((cells) => cells.map(csvCell).join(","))
			.join("\r\n") + "\r\n";
	}

	// A format with `bom` gets a byte order mark when saved to a file, because
	// Excel only reads a CSV file as UTF-8 when it starts with one.
	const FORMATS = [
		{
			id: "markdown",
			l10nID: "extra-columns-export-format-markdown",
			extension: "md",
			serialize: markdownTable,
		},
		{
			id: "latex",
			l10nID: "extra-columns-export-format-latex",
			extension: "tex",
			serialize: latexTable,
		},
		{
			id: "csv",
			l10nID: "extra-columns-export-format-csv",
			extension: "csv",
			bom: true,
			serialize: csvTable,
		},
	];

	function list() {
		return FORMATS.slice();
	}

	/** The format with this id, or the first format when there is none. */
	function get(id) {
		return FORMATS.find((format) => format.id === id) || FORMATS[0];
	}

	return { list, get, markdownCell, latexCell, csvCell };
})();
