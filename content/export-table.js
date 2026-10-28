/*
 * The columns and cell values for Export as Table, and the choices it remembers.
 *
 * A column id is "field:<field id>" for one of this plugin's columns, or
 * "zotero:<key>" for one of Zotero's. Zotero's keys match the item list's data
 * keys, so the item list's current columns can be picked up.
 */

/* global Zotero, ItemData, Columns */

var ExportTable = (function () {
	"use strict";

	const PREF = "extensions.extra-columns.export";

	// Zotero's item-list columns, with the string each one uses as its header.
	// Columns about the library rather than the item (Notes, Feed, Added By and
	// so on) are left out. Entries with an l10nID aren't item-list columns.
	// Entries marked `latex` give LaTeX, which the LaTeX format doesn't escape.
	const ZOTERO_COLUMNS = [
		{ key: "title", string: "itemFields.title" },
		{ key: "firstCreator", string: "zotero.items.creator_column" },
		{ key: "creators", l10nID: "extra-columns-export-col-creators" },
		{ key: "itemType", string: "zotero.items.itemType" },
		{ key: "date", string: "itemFields.date" },
		{ key: "year", string: "zotero.items.year_column" },
		{ key: "publisher", string: "itemFields.publisher" },
		{ key: "publicationTitle", string: "itemFields.publicationTitle" },
		{ key: "journalAbbreviation", string: "itemFields.journalAbbreviation" },
		{ key: "volume", string: "itemFields.volume" },
		{ key: "issue", string: "itemFields.issue" },
		{ key: "pages", string: "itemFields.pages" },
		{ key: "edition", string: "itemFields.edition" },
		{ key: "number", string: "itemFields.number" },
		{ key: "series", string: "itemFields.series" },
		{ key: "seriesTitle", string: "itemFields.seriesTitle" },
		{ key: "place", string: "itemFields.place" },
		{ key: "court", string: "itemFields.court" },
		{ key: "medium", string: "itemFields.medium" },
		{ key: "type", string: "itemFields.type" },
		{ key: "system", string: "itemFields.system" },
		{ key: "language", string: "itemFields.language" },
		{ key: "shortTitle", string: "itemFields.shortTitle" },
		{ key: "DOI", string: "itemFields.DOI" },
		{ key: "ISBN", string: "itemFields.ISBN" },
		{ key: "ISSN", string: "itemFields.ISSN" },
		{ key: "url", string: "itemFields.url" },
		{ key: "accessDate", string: "itemFields.accessDate" },
		{ key: "archive", string: "itemFields.archive" },
		{ key: "archiveLocation", string: "itemFields.archiveLocation" },
		{ key: "libraryCatalog", string: "itemFields.libraryCatalog" },
		{ key: "callNumber", string: "itemFields.callNumber" },
		{ key: "rights", string: "itemFields.rights" },
		{ key: "citationKey", string: "itemFields.citationKey" },
		{ key: "citationTag", l10nID: "extra-columns-export-col-citation-tag" },
		{ key: "latexCitation", l10nID: "extra-columns-export-col-latex-citation", latex: true },
		{ key: "abstractNote", string: "itemFields.abstractNote" },
		{ key: "extra", string: "itemFields.extra" },
		{ key: "dateAdded", string: "itemFields.dateAdded" },
		{ key: "dateModified", string: "zotero.items.dateModified_column" },
	];
	const DEFAULT_ZOTERO_KEYS = ["title", "firstCreator", "year"];

	function zoteroLabel(column) {
		try {
			return Zotero.getString(column.string);
		}
		catch (e) {
			return column.key;
		}
	}

	/**
	 * Every column that can be exported: this plugin's first, then Zotero's.
	 * A column with an l10nID has no label yet; the caller formats it.
	 */
	function availableColumns(fields) {
		const custom = fields.map((field) => ({
			id: "field:" + field.id,
			label: field.label,
			align: field.type === "number" ? "end" : "start",
			field,
		}));
		const zotero = ZOTERO_COLUMNS.map((column) => ({
			id: "zotero:" + column.key,
			label: column.l10nID ? null : zoteroLabel(column),
			l10nID: column.l10nID,
			align: "start",
			latex: !!column.latex,
			key: column.key,
		}));
		return [...custom, ...zotero];
	}

	function defaultColumnIDs(fields) {
		return [
			...DEFAULT_ZOTERO_KEYS.map((key) => "zotero:" + key),
			...fields.map((field) => "field:" + field.id),
		];
	}

	/**
	 * The ids of the columns shown in the item list, in their order there.
	 * Zotero has no public API for this, so it returns [] if that ever changes.
	 */
	function itemListColumnIDs(fields) {
		let treeColumns;
		try {
			treeColumns = Zotero.getActiveZoteroPane().itemsView._getColumns();
		}
		catch (e) {
			Zotero.debug(`Extra Columns: could not read the item list's columns: ${e}`);
			return [];
		}
		if (!Array.isArray(treeColumns)) {
			return [];
		}

		const idsByDataKey = new Map(ZOTERO_COLUMNS.map((column) => [column.key, "zotero:" + column.key]));
		for (const field of fields) {
			const dataKey = Columns.getDataKey(field.id);
			if (dataKey) {
				idsByDataKey.set(dataKey, "field:" + field.id);
			}
		}
		return treeColumns
			.filter((column) => !column.hidden && idsByDataKey.has(column.dataKey))
			.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
			.map((column) => idsByDataKey.get(column.dataKey));
	}

	/** Regular items, once each, in the order given. Notes and attachments have no table row. */
	function exportableItems(items) {
		const seen = new Set();
		return items.filter((item) => {
			if (!item || seen.has(item.id) || !item.isRegularItem()) {
				return false;
			}
			seen.add(item.id);
			return true;
		});
	}

	/** Dates as the item list shows them, in the user's locale. */
	function localDate(value) {
		if (!value) {
			return "";
		}
		if (Zotero.Date.isSQLDate(value)) {
			const date = Zotero.Date.sqlToDate(value);
			return date ? date.toLocaleDateString() : "";
		}
		const date = Zotero.Date.sqlToDate(value, true);
		return date ? date.toLocaleString() : "";
	}

	/** The year from Date, as the item list shows it. */
	function year(item) {
		const value = item.getField("date", true, true).substr(0, 4);
		if (!value || value === "0000") {
			return "";
		}
		return /^\d{4}$/.test(value) ? String(Number(value)) : value;
	}

	function creatorName(creator) {
		if (creator.name) {
			return creator.name;
		}
		return [creator.lastName, creator.firstName].filter(Boolean).join(", ");
	}

	//
	// Citation keys, matching Zotero's BibTeX export (the BibTeX.js translator)
	//

	// Copied from BibTeX.js: words left out when picking the title word, and markup.
	const CITE_KEY_TITLE_BANNED = /\b(a|an|the|some|from|on|in|to|of|do|with|der|die|das|ein|eine|einer|eines|einem|einen|un|une|la|le|l\'|les|el|las|los|al|uno|una|unos|unas|de|des|del|d\')(\s+|\b)|(<\/?(i|b|sup|sub|sc|span style=\"small-caps\"|span)>)/g;
	const CITE_KEY_LEGACY_CLEAN = /[^a-z0-9\!\$\&\*\+\-\.\/\:\;\<\>\?\[\]\^\_\`\|]+/g;
	const CITE_KEY_SIMPLE_CLEAN = /[^a-z0-9_-]/g;

	/** The first non-empty "Citation Key:" line in Extra, parsed the way BibTeX.js does. */
	function extraCitationKey(extra) {
		for (const line of String(extra || "").split(/[\r\n]+/)) {
			const trimmed = line.trim();
			const splitAt = trimmed.indexOf(":");
			if (splitAt > 1 && trimmed.substr(0, splitAt).trim().toLowerCase() === "citation key") {
				const value = trimmed.substr(splitAt + 1).trim();
				if (value) {
					return value;
				}
			}
		}
		return "";
	}

	/**
	 * The key BibTeX.js makes up for an item with no stored key: "%a_%t_%y",
	 * for example "smith_climate_2020". Keys already in `usedKeys` get "-1", "-2"
	 * and so on, as they do within one BibTeX export.
	 * @param {{lastName: string, title: string, date: string, dateAdded: string}} data
	 * @param {Set<string>} usedKeys - Shared by all items in one export; updated.
	 */
	function generatedCitationKey({ lastName, title, date, dateAdded }, usedKeys) {
		const author = lastName ? lastName.toLowerCase().replace(/ /g, "_").replace(/,/g, "") : "noauthor";
		const titleWord = title ? title.toLowerCase().replace(CITE_KEY_TITLE_BANNED, "").split(/\s+/g)[0] : "notitle";
		let year = "nodate";
		if (date) {
			const parsed = Zotero.Date.strToDate(date);
			if (parsed.year && /^[0-9]+/.test(parsed.year)) {
				year = String(parsed.year);
			}
		}

		// Items added since 2020 get the simpler key characters, as in BibTeX.js.
		const simple = Zotero.Prefs.get("translators.BibTeX.export.simpleCitekey")
			|| (dateAdded && parseInt(dateAdded.substr(0, 4)) >= 2020);
		const base = Zotero.Utilities.removeDiacritics(`${author}_${titleWord}_${year}`.toLowerCase(), true)
			.replace(simple ? CITE_KEY_SIMPLE_CLEAN : CITE_KEY_LEGACY_CLEAN, "");

		let key = base;
		for (let i = 1; usedKeys.has(key); i++) {
			key = `${base}-${i}`;
		}
		usedKeys.add(key);
		return key;
	}

	/**
	 * The key a BibTeX export would use: a "Citation Key:" line in Extra, Zotero's
	 * Citation Key field, Better BibTeX's key if it's installed, or a generated key.
	 */
	function citationKey(item, usedKeys) {
		const stored = extraCitationKey(item.getField("extra")) || item.getField("citationKey", false, true);
		if (stored) {
			return stored;
		}
		try {
			const key = Zotero.BetterBibTeX?.KeyManager?.get(item.id)?.citationKey;
			if (key) {
				return key;
			}
		}
		catch (e) {
			Zotero.debug(`Extra Columns: could not get a Better BibTeX key for item ${item.id}: ${e}`);
		}
		return generatedCitationKey({
			lastName: item.getCreators()[0]?.lastName || "",
			title: item.getField("title", false, true),
			date: item.getField("date", false, true),
			dateAdded: item.dateAdded || "",
		}, usedKeys);
	}

	/**
	 * The item's key, worked out once per export, so both citation columns
	 * show the same key and a built key isn't counted as its own duplicate.
	 */
	function exportCitationKey(item, exportState) {
		if (!exportState.keysByItem.has(item.id)) {
			exportState.keysByItem.set(item.id, citationKey(item, exportState.citationKeys));
		}
		return exportState.keysByItem.get(item.id);
	}

	/** @param {object} exportState - Shared by all cells in one export. */
	function zoteroValue(item, key, exportState) {
		switch (key) {
			case "title":
				return item.getDisplayTitle();
			case "firstCreator":
				return item.getField("firstCreator", true);
			case "creators":
				return item.getCreatorsJSON().map(creatorName).filter(Boolean).join("; ");
			case "itemType":
				return Zotero.ItemTypes.getLocalizedString(item.itemTypeID);
			case "year":
				return year(item);
			case "citationTag": {
				const key = exportCitationKey(item, exportState);
				return key ? "@" + key : "";
			}
			case "latexCitation": {
				const key = exportCitationKey(item, exportState);
				return key ? `\\cite{${key}}` : "";
			}
			case "accessDate":
			case "dateAdded":
			case "dateModified":
				return localDate(item.getField(key, false, true));
			default:
				return item.getField(key, false, true);
		}
	}

	function cellValue(item, column, exportState) {
		try {
			const value = column.field
				? ItemData.readValue(item, column.field)
				: zoteroValue(item, column.key, exportState);
			return String(value ?? "");
		}
		catch (e) {
			Zotero.debug(`Extra Columns: could not read ${column.id} for item ${item.id}: ${e}`);
			return "";
		}
	}

	/** One array of cell text per item, in column order. */
	function rows(items, columns) {
		const exportState = { citationKeys: new Set(), keysByItem: new Map() };
		return items.map((item) => columns.map((column) => cellValue(item, column, exportState)));
	}

	/** The format and columns used last time. Either can be null. */
	function loadSettings() {
		let parsed = null;
		try {
			parsed = JSON.parse(Zotero.Prefs.get(PREF, true) || "null");
		}
		catch (e) {
			Zotero.logError(new Error(`Extra Columns: ${PREF} is not valid JSON`));
		}
		return {
			format: typeof parsed?.format === "string" ? parsed.format : null,
			columnIDs: Array.isArray(parsed?.columnIDs) ? parsed.columnIDs.map(String) : null,
		};
	}

	function saveSettings({ format, columnIDs }) {
		Zotero.Prefs.set(PREF, JSON.stringify({ format, columnIDs }), true);
	}

	return {
		availableColumns,
		defaultColumnIDs,
		itemListColumnIDs,
		exportableItems,
		rows,
		extraCitationKey,
		generatedCitationKey,
		loadSettings,
		saveSettings,
	};
})();
