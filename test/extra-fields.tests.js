// Tests for Extra Columns' Extra-field parsing and number sorting.
//
// How to run:
//   1. Install and enable the plugin.
//   2. In Zotero, open Tools > Developer > Run JavaScript.
//   3. Tick "Run as async function", paste this whole file, and click Run.
// The result pane lists every check, with a summary on the first line.
// These tests only read; they don't change any items or settings.

const api = Zotero.ExtraColumns;
if (!api) {
	return "Extra Columns isn't running. Enable it in Tools > Plugins first.";
}
const EF = api.ExtraFields;
const results = [];

function check(name, actual, expected) {
	const pass = JSON.stringify(actual) === JSON.stringify(expected);
	results.push(pass
		? `PASS  ${name}`
		: `FAIL  ${name}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
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

// Export as Table: columns
const exportFields = [{ id: "abc", label: "Reading status", key: "Reading Status", type: "text" },
	{ id: "def", label: "Rating", key: "Rating", type: "number" }];
const exportColumns = api.ExportTable.availableColumns(exportFields);
check("export columns: plugin columns first",
	exportColumns.slice(0, 2).map((column) => [column.id, column.label, column.align]),
	[["field:abc", "Reading status", "start"], ["field:def", "Rating", "end"]]);
check("export columns: Zotero title has a label",
	!!exportColumns.find((column) => column.id === "zotero:title")?.label, true);
check("export columns: ids are unique",
	new Set(exportColumns.map((column) => column.id)).size, exportColumns.length);

const failed = results.filter((line) => line.startsWith("FAIL")).length;
return `${results.length - failed} of ${results.length} checks passed${failed ? `, ${failed} failed` : ""}\n\n`
	+ results.join("\n");
