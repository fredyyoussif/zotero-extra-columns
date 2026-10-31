// Tests for Extra Columns.
//
// How to run:
//   1. Install and enable the plugin.
//   2. In Zotero, open Tools > Developer > Run JavaScript.
//   3. Tick "Run as async function", paste this whole file, and click Run.
// The result pane lists every check, with a summary on the first line.
// These tests don't change any items. The Export as Table checks open the
// dialog with up to three of the selected items (or the first items in My
// Library), and put back the export settings they change.
//
// test/run_offline.py also runs this file outside Zotero, with only the
// modules that don't need Zotero. It sets api.offline, and the checks that
// need Zotero are skipped.

const api = Zotero.ExtraColumns;
if (!api) {
	return "Extra Columns isn't running. Enable it in Tools > Plugins first.";
}
const offline = api.offline === true;
const EF = api.ExtraFields;
const results = [];

function check(name, actual, expected) {
	const pass = JSON.stringify(actual) === JSON.stringify(expected);
	results.push(pass
		? `PASS  ${name}`
		: `FAIL  ${name}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
}

/** For checks whose failure is best explained in words. */
function checkThat(name, pass, explanation) {
	results.push(pass ? `PASS  ${name}` : `FAIL  ${name}\n      ${explanation}`);
}

function skip(name, reason) {
	results.push(`SKIP  ${name}: ${reason}`);
}

// Key normalisation matches Zotero's
check("normalize camelCase", EF.normalizeKey("readingStatus"), "reading-status");
check("normalize spaces", EF.normalizeKey(" Reading Status "), "reading-status");
check("normalize underscores", EF.normalizeKey("reading_status"), "reading-status");

// Key syntax
check("key: words with space", EF.isValidKeySyntax("Reading Status"), true);
check("key: period allowed", EF.isValidKeySyntax("tex.note"), true);
check("key: must start with a letter", EF.isValidKeySyntax("1st"), false);
check("key: no colon", EF.isValidKeySyntax("a:b"), false);
check("key: no surrounding space", EF.isValidKeySyntax("Key "), false);
check("key: not empty", EF.isValidKeySyntax(""), false);
check("suggest key strips symbols", EF.suggestKeyFromLabel("Rating (1-5)"), "Rating 1-5");
check("suggest key trims", EF.suggestKeyFromLabel("  Reading status  "), "Reading status");
check("suggest key needs a letter first", EF.suggestKeyFromLabel("2nd reader"), "");

// Reading values
check("get simple", EF.getValue("Reading Status: done", "Reading Status"), "done");
check("get matches normalised key", EF.getValue("readingStatus: done", "Reading Status"), "done");
check("get first of duplicates", EF.getValue("Reading Status: a\nReading Status: b", "Reading Status"), "a");
check("get skips empty value", EF.getValue("Reading Status:\nReading Status: later", "Reading Status"), "later");
check("get without space after colon", EF.getValue("Rating:5", "Rating"), "5");
check("get keeps colons in value", EF.getValue("Link note: see http://x.org", "Link note"), "see http://x.org");
check("get handles CRLF", EF.getValue("Rating: 4\r\nOther: x", "Rating"), "4");
check("get ignores indented line", EF.getValue("  Rating: 4", "Rating"), "");
check("get missing key", EF.getValue("Other: x", "Rating"), "");
check("get empty extra", EF.getValue("", "Rating"), "");

// Writing values
check("set into empty extra", EF.setValue("", "Reading Status", "to read"), "Reading Status: to read");
check("set appends and keeps other lines",
	EF.setValue("PMID: 123\nfree text line", "Reading Status", "done"),
	"PMID: 123\nfree text line\nReading Status: done");
check("set replaces in place",
	EF.setValue("A: 1\nreading status: old\nB: 2", "Reading Status", "new"),
	"A: 1\nReading Status: new\nB: 2");
check("set removes duplicates",
	EF.setValue("readingStatus: x\nC\nReading Status: y", "Reading Status", "z"),
	"Reading Status: z\nC");
check("set empty removes line", EF.setValue("A\nReading Status: x\nB", "Reading Status", ""), "A\nB");
check("set empty on only line", EF.setValue("Reading Status: x", "Reading Status", ""), "");
check("set keeps trailing newline", EF.setValue("Note\n", "K", "v"), "Note\nK: v\n");
check("set flattens line breaks", EF.setValue("", "K", "a\nb\r\nc"), "K: a b c");
check("set leaves other keys alone", EF.setValue("Rating: 1\nRatings: 2", "Rating", "3"), "Rating: 3\nRatings: 2");

// Canonical numbers
const numberCases = [
	["1.50", "1.5"], ["007", "7"], ["-0", "0"], ["-0.0", "0"], ["+3", "3"], [".5", "0.5"],
	["5.", "5"], ["-12.340", "-12.34"], ["0000000000000000001", "1"], [" 42 ", "42"],
	["abc", null], ["1e3", null], ["1,000", null], ["", null], ["-", null], [".", null],
	["1234567890123456", null], ["0.12345678901", null],
];
for (const [input, expected] of numberCases) {
	check(`canonical number ${JSON.stringify(input)}`, EF.canonicalNumber(input), expected);
}

// Number sort keys and display
check("display from number key", EF.displayFromSortKey(EF.numberSortKey("00000123")), "00000123");
check("display from text key", EF.displayFromSortKey(EF.numberSortKey("about 5")), "about 5");
check("empty value has empty key", EF.numberSortKey(""), "");

const values = ["10", "-2", "", "3", "abc", "-1.5", "2.25", "0", "-0.5", "007", "1e3"];
const expectedOrder = ["-2", "-1.5", "-0.5", "0", "2.25", "3", "007", "10", "1e3", "abc", ""];

function sortWith(compare) {
	return values
		.map((value) => ({ value, key: EF.numberSortKey(value) }))
		.sort((a, b) => {
			// Zotero's item list puts empty values last.
			if (a.key === "" && b.key !== "") return 1;
			if (a.key !== "" && b.key === "") return -1;
			return compare(a.key, b.key);
		})
		.map((entry) => entry.value);
}

// Collation needs Intl and Zotero, so these only run in Zotero.
if (!offline) {
	for (const numeric of [true, false]) {
		const collator = new Intl.Collator("en", { numeric, sensitivity: "base" });
		check(`number sort order, natural sorting ${numeric ? "on" : "off"}`,
			sortWith((a, b) => collator.compare(a, b)), expectedOrder);
	}
	const zoteroCollation = Zotero.getLocaleCollation();
	check("number sort order, Zotero's current collation",
		sortWith((a, b) => zoteroCollation.compareString(1, a, b)), expectedOrder);

	// Reserved keys (asks Zotero's own Extra parser)
	check("reserved: Archive is a Zotero field", api.FieldConfig.isReservedKey("Archive"), true);
	check("reserved: Language is a Zotero field", api.FieldConfig.isReservedKey("Language"), true);
	check("reserved: Editor is a creator type", api.FieldConfig.isReservedKey("Editor"), true);
	check("reserved: type", api.FieldConfig.isReservedKey("type"), true);
	check("not reserved: Reading Status", api.FieldConfig.isReservedKey("Reading Status"), false);
	check("not reserved: My Rating", api.FieldConfig.isReservedKey("My Rating"), false);
}

// Export as Table: Markdown output
const XF = api.ExportFormats;
check("markdown cell escapes pipes", XF.markdownCell("a|b"), "a\\|b");
check("markdown cell escapes backslashes", XF.markdownCell("C:\\temp"), "C:\\\\temp");
check("markdown cell flattens line breaks", XF.markdownCell("line one\r\n\n  line two"), "line one line two");
check("markdown cell trims", XF.markdownCell("  x  "), "x");
check("markdown cell empty", XF.markdownCell(null), "");
check("markdown table",
	XF.get("markdown").serialize(
		[{ label: "Title", align: "start" }, { label: "Rating", align: "end" }],
		[["A | B", "4"], ["C", ""]]),
	"| Title | Rating |\n| --- | ---: |\n| A \\| B | 4 |\n| C |  |\n");
check("unknown format falls back to the first", XF.get("nope").id, XF.list()[0].id);

// Export as Table: LaTeX output
check("latex cell escapes specials", XF.latexCell("50% & $5 #1 a_b {x}"), "50\\% \\& \\$5 \\#1 a\\_b \\{x\\}");
check("latex cell escapes backslash, tilde and caret", XF.latexCell("C:\\~^"),
	"C:\\textbackslash{}\\textasciitilde{}\\textasciicircum{}");
check("latex cell flattens line breaks", XF.latexCell("line one\n line two"), "line one line two");
check("latex table",
	XF.get("latex").serialize(
		[{ label: "Title", align: "start" }, { label: "Cite", align: "start", latex: true }, { label: "Rating", align: "end" }],
		[["A & B", "\\cite{a_b}", "4"]]),
	"\\begin{tabular}{llr}\n\\hline\nTitle & Cite & Rating \\\\\n\\hline\nA \\& B & \\cite{a_b} & 4 \\\\\n\\hline\n\\end{tabular}\n");

// Export as Table: CSV output
check("csv cell plain", XF.csvCell("abc"), "abc");
check("csv cell quotes commas", XF.csvCell("a, b"), "\"a, b\"");
check("csv cell doubles quotes", XF.csvCell("say \"hi\""), "\"say \"\"hi\"\"\"");
check("csv cell keeps line breaks", XF.csvCell("a\nb"), "\"a\nb\"");
check("csv table",
	XF.get("csv").serialize([{ label: "Title" }, { label: "Rating" }], [["A, B", "4"], ["C", ""]]),
	"Title,Rating\r\n\"A, B\",4\r\nC,\r\n");

check("latex escape keeps spacing", XF.latexEscape(" 5% "), " 5\\% ");

// Export as Table: combined column templates
const XT = api.ExportTemplate;
const sample = { citekey: "smith_2020", year: "2020", Disorder: "PD", Function: "", latex: "\\cite{x}" };
const fill = (template, values = sample, escape) =>
	XT.render(XT.parse(template).nodes, (name) => values[name] ?? "", escape);
check("template: fields and text", fill("@{citekey} ({year})"), "@smith_2020 (2020)");
check("template: field names are trimmed", fill("{ year }"), "2020");
check("template: optional section shown", fill("@{citekey}[ ({year})]"), "@smith_2020 (2020)");
check("template: optional section left out", fill("@{citekey}[ ({year})]", { citekey: "a" }), "@a");
check("template: separator kept between shown sections",
	fill("[D: {Disorder}]; [F: {Disorder}]"), "D: PD; F: PD");
check("template: separator dropped when the second is empty",
	fill("[D: {Disorder}]; [F: {Function}]"), "D: PD");
check("template: separator dropped when the first is empty",
	fill("[F: {Function}]; [D: {Disorder}]"), "D: PD");
check("template: middle section left out",
	fill("[{year}], [{Function}]; [{Disorder}]"), "2020; PD");
check("template: all sections empty", fill("[D: {Function}]; [F: {Function}]"), "");
check("template: section needs every field in it", fill("[{year}-{Function}]"), "");
check("template: nested section", fill("[Notes: {year}[ and {Function}]]"), "Notes: 2020");
check("template: section without fields is left out", fill("a[b]c"), "ac");
check("template: escapes", fill("\\{x\\} \\[y\\] a\\\\b \\n"), "{x} [y] a\\b \\n");
check("template: escape applies to text, not values",
	fill("{latex} 5%", sample, XF.latexEscape), "\\cite{x} 5\\%");
check("template: field names in order", XT.fieldNames(XT.parse("{a}[{b} {a}]{c}").nodes), ["a", "b", "c"]);
check("template: unclosed brace", XT.parse("{a").error, "unclosed-brace");
check("template: brace inside a name", XT.parse("{a{b}").error, "unclosed-brace");
check("template: stray closing brace", XT.parse("a}").error, "unexpected-brace");
check("template: unclosed bracket", XT.parse("[{a}").error, "unclosed-bracket");
check("template: stray closing bracket", XT.parse("{a}]").error, "unexpected-bracket");
check("template: empty name", XT.parse("{ }").error, "empty-name");
check("template: names ignore case and punctuation", XT.normalizeName("Brain Function(s)"), "brainfunctions");

// Export as Table: columns
const exportFields = [{ id: "abc", label: "Reading status", key: "Reading Status", type: "text" },
	{ id: "def", label: "Rating", key: "Rating", type: "number" }];
const exportColumns = api.ExportTable.availableColumns(exportFields);
check("export columns: plugin columns first",
	exportColumns.slice(0, 2).map((column) => [column.id, column.label, column.align]),
	[["field:abc", "Reading status", "start"], ["field:def", "Rating", "end"]]);
check("export columns: Zotero title has a label",
	!!exportColumns.find((column) => column.id === "zotero:title")?.label, true);
check("export columns: citation tag is offered",
	exportColumns.some((column) => column.id === "zotero:citationTag"), true);
check("export columns: LaTeX citation is offered and not escaped",
	exportColumns.find((column) => column.id === "zotero:latexCitation")?.latex, true);
// Labels for columns with an l10nID are filled in by the dialog.
const exportSources = api.ExportTable.templateSources(
	exportColumns.map((column) => ({ ...column, label: column.label || column.key })));
const combinedColumn = (template) =>
	api.ExportTable.combinedColumn({ id: "t", label: "T", template }, exportSources).combined;
check("combined column: id",
	api.ExportTable.combinedColumn({ id: "t", label: "T", template: "" }, exportSources).id, "combined:t");
check("combined column: finds fields by key, label and Zotero key",
	[...combinedColumn("{reading_status} {Rating} {YEAR} {citekey}").columnsByName.values()].map((column) => column.id),
	["field:abc", "field:def", "zotero:year", "zotero:citekey"]);
check("combined column: unknown field",
	combinedColumn("{year} {nope}").error, { code: "unknown-field", name: "nope" });
check("combined column: syntax error", combinedColumn("{year").error, { code: "unclosed-brace" });

// Export as Table: saved layouts
check("layouts: cleaned",
	api.ExportTable.cleanLayouts([
		{ name: " A ", format: "csv", columnIDs: ["zotero:year", 3] },
		{ name: "A", format: "latex", columnIDs: [] },
		{ name: "", columnIDs: [] },
		{ name: "B" },
		null,
	]),
	[{ name: "A", format: "csv", columnIDs: ["zotero:year", "3"] }]);
check("layouts: not a list", api.ExportTable.cleanLayouts({ name: "A" }), []);
const layoutA = { name: "A", format: "csv", columnIDs: ["zotero:year"] };
const layoutB = { name: "B", format: "markdown", columnIDs: [] };
check("layouts: saving a new name adds it",
	api.ExportTable.putLayout([layoutA], layoutB), [layoutA, layoutB]);
check("layouts: saving a used name replaces it in place",
	api.ExportTable.putLayout([layoutA, layoutB], { ...layoutA, format: "latex" }),
	[{ ...layoutA, format: "latex" }, layoutB]);
// Export as Table: citation keys, matching Zotero's BibTeX export
const ET = api.ExportTable;
check("cite key from Extra", ET.extraCitationKey("Note\n citation key : abc \nCitation Key: def"), "abc");
check("cite key from Extra skips empty", ET.extraCitationKey("Citation Key:\nCitation Key: x"), "x");
check("cite key from Extra missing", ET.extraCitationKey("PMID: 1"), "");
// Built keys use Zotero's date parser and preferences.
if (!offline) {
	const recent = "2021-01-01 00:00:00";
	const keysA = new Set();
	check("built cite key",
		ET.generatedCitationKey({ lastName: "Smith", title: "The Art of War", date: "2020-05-01", dateAdded: recent }, keysA),
		"smith_art_2020");
	check("built cite key, duplicate gets a suffix",
		ET.generatedCitationKey({ lastName: "Smith", title: "Art and War", date: "May 2020", dateAdded: recent }, keysA),
		"smith_art_2020-1");
	check("built cite key, nothing to use",
		ET.generatedCitationKey({ lastName: "", title: "", date: "", dateAdded: recent }, new Set()),
		"noauthor_notitle_nodate");
	// BibTeX.js leaves the title word empty when markup or a skipped word comes first.
	check("built cite key, two-word surname and markup",
		ET.generatedCitationKey({ lastName: "Van Dyke", title: "<i>Of</i> Mice", date: "1999", dateAdded: recent }, new Set()),
		"van_dyke__1999");
	check("built cite key, simple characters since 2020",
		ET.generatedCitationKey({ lastName: "Lee", title: "C++ guide", date: "2010", dateAdded: recent }, new Set()),
		"lee_c_2010");
	check("built cite key, legacy characters before 2020",
		ET.generatedCitationKey({ lastName: "Lee", title: "C++ guide", date: "2010", dateAdded: "2015-06-01 00:00:00" }, new Set()),
		"lee_c++_2010");
}

check("export columns: ids are unique",
	new Set(exportColumns.map((column) => column.id)).size, exportColumns.length);

// Export as Table: real items and the real dialog
if (!offline) {
	const testItems = await exportTestItems();
	if (!testItems.length) {
		skip("export with real items", "there are no regular items in My Library");
	}
	else {
		await realItemChecks(testItems);
		await exportDialogChecks(testItems);
	}
}

/** Up to three regular items: the selected ones, or else the first in My Library. */
async function exportTestItems() {
	const selected = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
	let found = ET.exportableItems(selected);
	if (!found.length) {
		found = ET.exportableItems(await Zotero.Items.getAll(Zotero.Libraries.userLibraryID, true));
	}
	return found.slice(0, 3);
}

async function realItemChecks(items) {
	const byKey = (key) => exportColumns.find((column) => column.id === "zotero:" + key);
	check("real items: a combined column gives the same as the plain column",
		ET.rows(items, [ET.combinedColumn({ id: "y", label: "Y", template: "{year}" }, exportSources)]),
		ET.rows(items, [byKey("year")]));
	check("real items: both citation columns use the same key",
		ET.rows(items, [byKey("citationTag"), byKey("latexCitation")])
			.map(([tag, latex]) => latex === `\\cite{${tag.slice(1)}}`),
		items.map(() => true));
	check("real items: LaTeX escapes a combined column's text",
		ET.rows(items.slice(0, 1), [ET.combinedColumn({ id: "p", label: "P", template: "50% & {latexCitation}" },
			exportSources)], api.ExportFormats.get("latex").escape)[0][0].startsWith("50\\% \\& \\cite{"),
		true);
}

/**
 * Opens Export as Table as the item menu does, then checks that it set itself
 * up, is laid out and translated, and that the combined column editor works.
 */
async function exportDialogChecks(items) {
	const PREF = "extensions.extra-columns.export";
	const savedPref = Zotero.Prefs.get(PREF, true);
	const testLayout = { name: "Extra Columns test layout", format: "csv", columnIDs: ["zotero:year", "zotero:title"] };
	ET.saveSettings({ layouts: ET.putLayout(ET.loadSettings().layouts, testLayout), layout: null });
	const win = Zotero.getMainWindow().openDialog("chrome://extra-columns/content/export.xhtml", "",
		"chrome,dialog,resizable", { items, skippedCount: 0 });
	const waitFor = async (condition, ms = 5000) => {
		const deadline = Date.now() + ms;
		while (!condition() && Date.now() < deadline) {
			await Zotero.Promise.delay(50);
		}
		return condition();
	};
	try {
		// A boolean: returning the promise itself would make waitFor wait for it.
		const scriptLoaded = await waitFor(() => win.closed || !!win.ExtraColumnsExport?.ready);
		if (!scriptLoaded || win.closed) {
			checkThat("export dialog: script loads", false,
				`window ${win.closed ? "closed" : "open"}, document ${win.document?.readyState}, `
				+ `script ${typeof win.ExtraColumnsExport}, location ${win.location?.href}\n      `
				+ await dialogFileDiagnosis());
			return;
		}
		checkThat("export dialog: script loads", true);
		const outcome = await Promise.race([
			win.ExtraColumnsExport.ready.then(() => "ready", (e) => `failed: ${e}\n${e?.stack || ""}`),
			Zotero.Promise.delay(10000).then(() => "still loading after 10 seconds"),
		]);
		checkThat("export dialog: sets itself up", outcome === "ready", outcome);
		if (outcome !== "ready") {
			return;
		}

		const doc = win.document;
		const byID = (id) => doc.getElementById(id);
		const dialog = byID("extra-columns-export");
		await doc.l10n.translateElements([...doc.querySelectorAll("[data-l10n-id]")]);

		const box = byID("extra-columns-export-columns").getBoundingClientRect();
		checkThat("export dialog: column list is laid out", box.width > 0 && box.height > 0,
			`the column list is ${box.width} × ${box.height}`);
		const rows = () => [...doc.querySelectorAll(".extra-columns-export-row")];
		checkThat("export dialog: lists columns", rows().length >= exportColumns.length - exportFields.length,
			`${rows().length} rows`);
		const unlabelled = rows().filter((row) => !row.querySelector("label").textContent.trim());
		checkThat("export dialog: every column has a name", !unlabelled.length,
			`no name: ${unlabelled.map((row) => row.dataset.columnId).join(", ")}`);
		const formats = [...byID("extra-columns-export-format").menupopup.children].map((item) => item.label);
		check("export dialog: format menu", formats.length === api.ExportFormats.list().length && formats.every(Boolean), true);
		checkThat("export dialog: buttons are translated",
			!!dialog.getButton("accept").label && !!byID("extra-columns-export-add-combined").label,
			`Save "${dialog.getButton("accept").label}", Add combined column "${byID("extra-columns-export-add-combined").label}"`);
		checkThat("export dialog: summary is translated", !!byID("extra-columns-export-summary").textContent.trim(),
			"the item count line is empty");
		checkThat("export dialog: insert field menu lists fields",
			byID("extra-columns-export-insert").menupopup.children.length > exportColumns.length - exportFields.length,
			`${byID("extra-columns-export-insert").menupopup.children.length} entries`);

		// Each part's width with nothing wrapped, widest first. Parts whose text
		// is meant to wrap count as narrow.
		const content = doc.querySelector("#extra-columns-export > vbox");
		const naturalWidths = () => [...content.children, dialog.getButton("accept").parentElement]
			.filter((part) => part.getBoundingClientRect().height > 0)
			.map((part) => {
				const saved = part.style.width;
				part.style.width = "max-content";
				const width = part.getBoundingClientRect().width;
				part.style.width = saved;
				return { name: part.id || part.className || part.localName, width };
			})
			.sort((a, b) => b.width - a.width);
		const checkWidth = (name) => {
			const widths = naturalWidths();
			const margins = win.innerWidth - content.getBoundingClientRect().width;
			const needed = Math.max(widths[0].width + margins, parseFloat(win.getComputedStyle(dialog).minWidth) || 0);
			checkThat(name, win.innerWidth <= needed + 30,
				`the window is ${win.innerWidth} px wide but needs about ${Math.round(needed)} px. Widest parts: `
				+ widths.slice(0, 4).map((part) => `${part.name} ${Math.round(part.width)} px`).join(", "));
		};
		checkWidth("export dialog: no wider than it needs to be");

		// The combined column editor
		const combinedRows = () => rows().filter((row) => row.dataset.columnId.startsWith("combined:"));
		const before = combinedRows().length;
		byID("extra-columns-export-add-combined").doCommand();
		const editor = byID("extra-columns-export-editor");
		checkThat("combined editor: opens", await waitFor(() => !editor.hidden, 2000), "the editor stayed hidden");
		check("combined editor: adds a ticked row", combinedRows().length, before + 1);
		const help = byID("extra-columns-export-combined-help");
		const helpBox = help.getBoundingClientRect();
		checkThat("combined editor: help text wraps rather than widening the window",
			helpBox.height > 2 * parseFloat(win.getComputedStyle(help).fontSize),
			`the help text is on one line, ${Math.round(helpBox.width)} px wide`);
		checkThat("combined editor: fits the dialog's width", editor.scrollWidth <= editor.clientWidth + 1,
			`its contents are ${editor.scrollWidth} px wide in ${editor.clientWidth} px`);
		checkWidth("combined editor: the dialog is no wider than it needs to be");

		const template = byID("extra-columns-export-combined-template");
		const status = byID("extra-columns-export-combined-status");
		const type = async (text) => {
			template.value = text;
			template.dispatchEvent(new win.Event("input", { bubbles: true }));
			await doc.l10n.translateElements([status, byID("extra-columns-export-invalid")]);
		};
		await type("{year} {no such field}");
		checkThat("combined editor: names an unknown field", status.textContent.includes("no such field"),
			`status says "${status.textContent}"`);
		check("combined editor: a broken template stops the export",
			[dialog.getButton("accept").disabled, byID("extra-columns-export-invalid").hidden], [true, false]);
		await type("@{citekey}[ ({year})]");
		const expected = ET.rows(items.slice(0, 1), [ET.combinedColumn(
			{ id: "x", label: "X", template: "@{citekey}[ ({year})]" }, ET.templateSources(exportColumnsForDialog()))])[0][0];
		checkThat("combined editor: previews the first item", status.textContent.includes(expected),
			`status says "${status.textContent}", expected it to include "${expected}"`);
		check("combined editor: a working template allows the export", byID("extra-columns-export-invalid").hidden, true);

		byID("extra-columns-export-combined-remove").doCommand();
		check("combined editor: remove closes it and drops the row", [editor.hidden, combinedRows().length], [true, before]);

		// Saved layouts
		const layoutMenu = byID("extra-columns-export-layout");
		const layoutItem = [...layoutMenu.menupopup.children].find((item) => item.value === testLayout.name);
		checkThat("layouts: menu lists saved layouts", !!layoutItem && !layoutMenu.disabled,
			`menu entries: ${[...layoutMenu.menupopup.children].map((item) => item.label).join(", ")}`);
		check("layouts: nothing chosen at first", [layoutMenu.value, byID("extra-columns-export-layout-delete").disabled],
			["", true]);
		if (layoutItem) {
			const ticked = () => rows().filter((row) => row.querySelector("input").checked).map((row) => row.dataset.columnId);
			layoutItem.doCommand();
			check("layouts: choosing one sets the format and columns",
				[byID("extra-columns-export-format").value, ticked()], [testLayout.format, testLayout.columnIDs]);
			check("layouts: the menu shows the chosen one, which can be deleted",
				[layoutMenu.value, byID("extra-columns-export-layout-delete").disabled], [testLayout.name, false]);
			check("layouts: choosing keeps the menu's entries", layoutItem.isConnected, true);

			// Untick a column, then choose the same layout again.
			rows().find((row) => row.dataset.columnId === "zotero:title").querySelector("input").click();
			layoutItem.doCommand();
			check("layouts: choosing the shown one again puts its columns back", ticked(), testLayout.columnIDs);
		}
	}
	catch (e) {
		checkThat("export dialog: checks run without errors", false, `${e}\n${e.stack}`);
	}
	finally {
		if (!win.closed) {
			win.close();
		}
		if (savedPref === undefined) {
			Zotero.Prefs.clear(PREF, true);
		}
		else {
			Zotero.Prefs.set(PREF, savedPref, true);
		}
	}
}

/** Whether the dialog's address leads to a file that can be read, for when it doesn't open. */
async function dialogFileDiagnosis() {
	const url = "chrome://extra-columns/content/export.xhtml";
	let resolved;
	try {
		resolved = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
			.getService(Components.interfaces.nsIChromeRegistry)
			.convertChromeURL(Services.io.newURI(url)).spec;
	}
	catch (e) {
		return `${url} isn't registered: ${e}`;
	}
	try {
		const text = await Zotero.File.getContentsFromURLAsync(url);
		return `${url} is ${resolved}, which can be read (${text.length} characters)`;
	}
	catch (e) {
		return `${url} is ${resolved}, which can't be read: ${e}`;
	}
}

/** The columns the dialog offers: your real columns, not the test's made-up ones. */
function exportColumnsForDialog() {
	const skipped = new Set(api.getSkippedFieldIDs());
	return ET.availableColumns(api.FieldConfig.load().filter((field) => !skipped.has(field.id)))
		.map((column) => ({ ...column, label: column.label || column.key }));
}

const failed = results.filter((line) => line.startsWith("FAIL")).length;
const passed = results.filter((line) => line.startsWith("PASS")).length;
const skipped = results.length - failed - passed;
return `${api.version ? `Extra Columns ${api.version}: ` : ""}`
	+ `${passed} of ${passed + failed} checks passed${failed ? `, ${failed} failed` : ""}`
	+ `${skipped ? `, ${skipped} skipped` : ""}\n\n${results.join("\n")}`;
