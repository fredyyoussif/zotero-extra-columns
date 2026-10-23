/*
 * The Export as Table dialog. main.js opens it with the items to export, and it
 * uses the plugin's logic through Zotero.ExtraColumns.
 */

/* global Zotero, ChromeUtils, document, window */

var ExtraColumnsExport = (function () {
	"use strict";

	const HTML_NS = "http://www.w3.org/1999/xhtml";

	let api = null;
	let dialog = null;
	let items = [];
	let fields = [];
	// Every exportable column, and the ids of the ticked ones in export order.
	let columns = [];
	let chosenIDs = [];
	let formatLabels = new Map();

	function byID(id) {
		return document.getElementById(id);
	}

	function html(tag, props = {}) {
		const element = document.createElementNS(HTML_NS, tag);
		Object.assign(element, props);
		return element;
	}

	function localize(element, l10nID, args) {
		document.l10n.setAttributes(element, l10nID, args);
		return element;
	}

	async function init() {
		api = Zotero.ExtraColumns;
		dialog = byID("extra-columns-export");
		const args = window.arguments?.[0] || {};
		if (!api || !args.items) {
			window.close();
			return;
		}
		items = args.items;

		const skipped = new Set(api.getSkippedFieldIDs());
		fields = api.FieldConfig.load().filter((field) => !skipped.has(field.id));
		columns = api.ExportTable.availableColumns(fields);
		for (const column of columns) {
			if (!column.label) {
				column.label = await document.l10n.formatValue(column.l10nID);
			}
		}

		const settings = api.ExportTable.loadSettings();
		const itemListIDs = api.ExportTable.itemListColumnIDs(fields);
		chosenIDs = knownIDs(settings.columnIDs);
		if (!chosenIDs.length) {
			chosenIDs = knownIDs(itemListIDs);
		}
		if (!chosenIDs.length) {
			chosenIDs = knownIDs(api.ExportTable.defaultColumnIDs(fields));
		}

		await renderFormats(settings.format);

		localize(dialog.getButton("accept"), "extra-columns-export-save");
		localize(dialog.getButton("extra1"), "extra-columns-export-copy");
		dialog.addEventListener("dialogaccept", onSave);
		dialog.addEventListener("dialogextra1", onCopy);

		const matchButton = byID("extra-columns-export-match");
		matchButton.disabled = !knownIDs(itemListIDs).length;
		matchButton.addEventListener("command", () => {
			chosenIDs = knownIDs(api.ExportTable.itemListColumnIDs(fields));
			renderColumns();
		});

		localize(byID("extra-columns-export-summary"), "extra-columns-export-summary", { count: items.length });
		if (args.skippedCount) {
			const note = byID("extra-columns-export-skipped");
			localize(note, "extra-columns-export-skipped", { count: args.skippedCount });
			note.hidden = false;
		}

		renderColumns();
	}

	/** Drop ids of columns that no longer exist, and duplicates. */
	function knownIDs(ids) {
		const available = new Set(columns.map((column) => column.id));
		return [...new Set(ids || [])].filter((id) => available.has(id));
	}

	//
	// Format
	//

	async function renderFormats(selectedID) {
		const formats = api.ExportFormats.list();
		const labels = await document.l10n.formatValues(formats.map((format) => ({ id: format.l10nID })));
		formatLabels = new Map(formats.map((format, i) => [format.id, labels[i] || format.id]));

		const menulist = byID("extra-columns-export-format");
		const popup = menulist.menupopup;
		popup.replaceChildren();
		for (const format of formats) {
			const item = document.createXULElement("menuitem");
			item.setAttribute("value", format.id);
			item.setAttribute("label", formatLabels.get(format.id));
			popup.append(item);
		}
		menulist.value = api.ExportFormats.get(selectedID).id;
	}

	function currentFormat() {
		return api.ExportFormats.get(byID("extra-columns-export-format").value);
	}

	//
	// Columns
	//

	/** Ticked columns first, in export order, then the rest in their usual order. */
	function renderColumns(focus) {
		const container = byID("extra-columns-export-columns");
		container.replaceChildren();

		const byColumnID = new Map(columns.map((column) => [column.id, column]));
		const chosen = chosenIDs.map((id) => byColumnID.get(id));
		const unchosen = columns.filter((column) => !chosenIDs.includes(column.id));

		chosen.forEach((column, index) => container.append(columnRow(column, index)));
		if (chosen.length && unchosen.length) {
			container.append(html("div", { className: "extra-columns-export-divider" }));
		}
		unchosen.forEach((column) => container.append(columnRow(column, -1)));

		dialog.getButton("accept").disabled = !chosenIDs.length;
		dialog.getButton("extra1").disabled = !chosenIDs.length;

		// Rows are rebuilt, so put focus back on the control that was used.
		if (focus) {
			const row = container.querySelector(`[data-column-id="${CSS.escape(focus.id)}"]`);
			const target = focus.control && row?.querySelector(`.${focus.control}`);
			(target && !target.disabled ? target : row?.querySelector("input"))?.focus();
		}
	}

	function columnRow(column, index) {
		const chosen = index >= 0;
		const row = html("div", { className: "extra-columns-export-row" + (chosen ? "" : " unchosen") });
		row.dataset.columnId = column.id;

		const checkboxID = "extra-columns-export-col-" + column.id.replace(/[^A-Za-z0-9_-]/g, "_");
		const checkbox = html("input", { type: "checkbox", id: checkboxID, checked: chosen });
		checkbox.addEventListener("change", () => toggleColumn(column.id, checkbox.checked));
		const label = html("label", { htmlFor: checkboxID, textContent: column.label });

		const up = moveButton("extra-columns-prefs-move-up", "move-up", () => moveColumn(index, -1));
		up.disabled = !chosen || index === 0;
		const down = moveButton("extra-columns-prefs-move-down", "move-down", () => moveColumn(index, 1));
		down.disabled = !chosen || index === chosenIDs.length - 1;

		row.append(checkbox, label, up, down);
		return row;
	}

	function moveButton(l10nID, className, onCommand) {
		const element = document.createXULElement("button");
		element.className = className;
		localize(element, l10nID);
		element.addEventListener("command", onCommand);
		return element;
	}

	function toggleColumn(id, checked) {
		chosenIDs = checked ? [...chosenIDs, id] : chosenIDs.filter((chosenID) => chosenID !== id);
		renderColumns({ id, control: null });
	}

	function moveColumn(index, delta) {
		const target = index + delta;
		if (target < 0 || target >= chosenIDs.length) {
			return;
		}
		const id = chosenIDs[index];
		const reordered = chosenIDs.slice();
		[reordered[index], reordered[target]] = [reordered[target], reordered[index]];
		chosenIDs = reordered;
		renderColumns({ id, control: delta < 0 ? "move-up" : "move-down" });
	}

	//
	// Output
	//

	function tableText(format) {
		const byColumnID = new Map(columns.map((column) => [column.id, column]));
		const chosen = chosenIDs.map((id) => byColumnID.get(id));
		return format.serialize(chosen, api.ExportTable.rows(items, chosen));
	}

	function remember(format) {
		api.ExportTable.saveSettings({ format: format.id, columnIDs: chosenIDs });
	}

	function onCopy() {
		const format = currentFormat();
		Zotero.Utilities.Internal.copyTextToClipboard(tableText(format));
		remember(format);
		window.close();
	}

	/** The dialog stays open until the file is saved, or if saving fails. */
	function onSave(event) {
		event.preventDefault();
		saveToFile()
			.then((saved) => {
				if (saved) {
					window.close();
				}
			})
			.catch(async (e) => {
				Zotero.logError(e);
				const [title, message] = await document.l10n.formatValues([
					{ id: "extra-columns-export-save-title" },
					{ id: "extra-columns-export-save-failed" },
				]);
				Zotero.alert(window, title, message);
			});
	}

	async function saveToFile() {
		const format = currentFormat();
		const [title, fileName] = await document.l10n.formatValues([
			{ id: "extra-columns-export-save-title" },
			{ id: "extra-columns-export-file-name" },
		]);

		const { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
		const picker = new FilePicker();
		picker.init(window, title, picker.modeSave);
		picker.appendFilter(formatLabels.get(format.id), "*." + format.extension);
		picker.defaultString = `${fileName}.${format.extension}`;
		picker.defaultExtension = format.extension;

		const result = await picker.show();
		if (result !== picker.returnOK && result !== picker.returnReplace) {
			return false;
		}
		await Zotero.File.putContentsAsync(picker.file, tableText(format));
		remember(format);
		return true;
	}

	return { init };
})();

window.addEventListener("load", () => {
	ExtraColumnsExport.init().catch((e) => {
		Zotero.logError(e);
		window.close();
	});
}, { once: true });
