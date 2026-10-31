/*
 * The Export as Table dialog. main.js opens it with the items to export, and it
 * uses the plugin's logic through Zotero.ExtraColumns.
 */

/* global Zotero, ChromeUtils, Services, document, window */

var ExtraColumnsExport = (function () {
	"use strict";

	const HTML_NS = "http://www.w3.org/1999/xhtml";

	let api = null;
	let dialog = null;
	let items = [];
	let fields = [];
	// The plugin's and Zotero's columns, and the columns templates can name.
	let baseColumns = [];
	let sources = new Map();
	// Saved combined columns, {id, label, template}, and the one being edited.
	let combined = [];
	let editingID = null;
	// Every exportable column, and the ids of the ticked ones in export order.
	let columns = [];
	let chosenIDs = [];
	let formatLabels = new Map();
	// Saved layouts, {name, format, columnIDs}, and the name of the one the
	// current choices come from, which may have been changed since.
	let layouts = [];
	let layoutName = null;
	// What the menu shows when no layout matches; `changed` has NAME_MARK for the name.
	let layoutLabels = {};
	const NAME_MARK = "\uE000";

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
		baseColumns = api.ExportTable.availableColumns(fields);
		for (const column of baseColumns) {
			if (!column.label) {
				column.label = await document.l10n.formatValue(column.l10nID);
			}
		}
		sources = api.ExportTable.templateSources(baseColumns);

		const settings = api.ExportTable.loadSettings();
		combined = settings.combined;
		buildColumns();
		const itemListIDs = api.ExportTable.itemListColumnIDs(fields);
		chosenIDs = knownIDs(settings.columnIDs);
		if (!chosenIDs.length) {
			chosenIDs = knownIDs(itemListIDs);
		}
		if (!chosenIDs.length) {
			chosenIDs = knownIDs(api.ExportTable.defaultColumnIDs(fields));
		}

		await renderFormats(settings.format);
		await initLayouts(settings);

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
		byID("extra-columns-export-add-combined").addEventListener("command", () => {
			addCombined().catch(Zotero.logError);
		});
		await initEditor();

		localize(byID("extra-columns-export-summary"), "extra-columns-export-summary", { count: items.length });
		if (args.skippedCount) {
			const note = byID("extra-columns-export-skipped");
			localize(note, "extra-columns-export-skipped", { count: args.skippedCount });
			note.hidden = false;
		}

		renderColumns();
		// The dialog sized itself before the columns were listed.
		window.sizeToContent();
	}

	/** Combined columns first, so new ones are easy to find, then the rest. */
	function buildColumns() {
		columns = [
			...combined.map((definition) => api.ExportTable.combinedColumn(definition, sources)),
			...baseColumns,
		];
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
	// Saved layouts
	//

	async function initLayouts(settings) {
		layouts = settings.layouts;
		layoutName = settings.layout;
		// Formatted once, so the menu can be updated straight after every change.
		const [none, choose, changed] = await document.l10n.formatValues([
			{ id: "extra-columns-export-layout-none" },
			{ id: "extra-columns-export-layout-choose" },
			{ id: "extra-columns-export-layout-changed", args: { name: NAME_MARK } },
		]);
		layoutLabels = { none, choose, changed };

		// The chosen item, not the menu's value, which may not be updated yet.
		// Choosing the layout that's already shown puts its choices back.
		byID("extra-columns-export-layout").addEventListener("command", (event) => {
			const name = event.target.getAttribute("value");
			if (name) {
				applyLayout(name);
			}
		});
		byID("extra-columns-export-layout-save").addEventListener("command", () => {
			saveLayout().catch(Zotero.logError);
		});
		byID("extra-columns-export-layout-delete").addEventListener("command", () => {
			deleteLayout().catch(Zotero.logError);
		});
		// Selects the chosen format first, in case the menu hasn't yet.
		const formatMenu = byID("extra-columns-export-format");
		formatMenu.addEventListener("command", (event) => {
			if (event.target.localName === "menuitem") {
				formatMenu.selectedItem = event.target;
			}
			showLayout();
		});

		renderLayouts();
	}

	function findLayout(name) {
		return layouts.find((layout) => layout.name === name);
	}

	function matchesChoices(layout) {
		return layout.format === currentFormat().id
			&& JSON.stringify(knownIDs(layout.columnIDs)) === JSON.stringify(chosenIDs);
	}

	/** Rebuilds the menu. Only when the list changes, never while an item is being chosen. */
	function renderLayouts() {
		const menulist = byID("extra-columns-export-layout");
		const popup = menulist.menupopup;
		popup.replaceChildren();
		// Shows "Choose a saved layout" or "Table 1 (changed)" in the closed
		// menu, but isn't in the list, since choosing it would do nothing.
		const status = document.createXULElement("menuitem");
		status.className = "layout-status";
		status.setAttribute("value", "");
		status.hidden = true;
		popup.append(status);
		for (const layout of layouts) {
			const item = document.createXULElement("menuitem");
			item.setAttribute("value", layout.name);
			item.setAttribute("label", layout.name);
			popup.append(item);
		}
		menulist.disabled = !layouts.length;
		showLayout();
	}

	/**
	 * Shows the layout the current choices match, or the one they came from
	 * marked as changed. Called after every change to the format or columns.
	 */
	function showLayout() {
		const menulist = byID("extra-columns-export-layout");
		if (!menulist.menupopup.firstChild) {
			// Before the menu is built.
			return;
		}
		let base = findLayout(layoutName);
		if (!base || !matchesChoices(base)) {
			base = layouts.find(matchesChoices) || base;
		}
		layoutName = base?.name ?? null;
		byID("extra-columns-export-layout-delete").disabled = !base;

		if (base && matchesChoices(base)) {
			menulist.value = base.name;
			return;
		}
		let label = layouts.length ? layoutLabels.choose : layoutLabels.none;
		if (base) {
			label = layoutLabels.changed.replace(NAME_MARK, base.name);
		}
		const status = menulist.menupopup.querySelector(".layout-status");
		status.setAttribute("label", label);
		menulist.selectedItem = status;
		// The menu copies the label when an item is chosen, so also set it here
		// for when the status item was already chosen.
		menulist.setAttribute("label", label);
	}

	function applyLayout(name) {
		const layout = findLayout(name);
		if (!layout) {
			return;
		}
		if (editingID) {
			setEditorShown(false);
		}
		layoutName = name;
		byID("extra-columns-export-format").value = api.ExportFormats.get(layout.format).id;
		chosenIDs = knownIDs(layout.columnIDs);
		renderColumns();
	}

	/** Saves the format and ticked columns under a name, replacing a layout with that name. */
	async function saveLayout() {
		const [title, text] = await document.l10n.formatValues([
			{ id: "extra-columns-export-layout-save-title" },
			{ id: "extra-columns-export-layout-save-prompt" },
		]);
		const input = { value: layoutName || "" };
		if (!Services.prompt.prompt(window, title, text, input, null, {})) {
			return;
		}
		const name = input.value.trim();
		if (!name) {
			return;
		}
		if (name !== layoutName && findLayout(name)) {
			const question = await document.l10n.formatValue("extra-columns-export-layout-replace", { name });
			if (!Services.prompt.confirm(window, title, question)) {
				return;
			}
		}
		layouts = api.ExportTable.putLayout(layouts, { name, format: currentFormat().id, columnIDs: chosenIDs });
		layoutName = name;
		api.ExportTable.saveSettings({ layouts, layout: name });
		renderLayouts();
	}

	async function deleteLayout() {
		const name = layoutName;
		if (!findLayout(name)) {
			return;
		}
		const [title, question] = await document.l10n.formatValues([
			{ id: "extra-columns-export-layout-delete-title" },
			{ id: "extra-columns-export-layout-delete-confirm", args: { name } },
		]);
		if (!Services.prompt.confirm(window, title, question)) {
			return;
		}
		layouts = layouts.filter((layout) => layout.name !== name);
		api.ExportTable.saveSettings({ layouts });
		renderLayouts();
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

		// A ticked combined column with a template problem would export wrong cells.
		const invalid = chosen.find((column) => column.combined?.error);
		const note = byID("extra-columns-export-invalid");
		note.hidden = !invalid;
		if (invalid) {
			localize(note, "extra-columns-export-invalid", { name: invalid.label });
		}
		dialog.getButton("accept").disabled = !chosenIDs.length || !!invalid;
		dialog.getButton("extra1").disabled = !chosenIDs.length || !!invalid;
		showLayout();

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
		row.classList.toggle("invalid", !!column.combined?.error);
		row.dataset.columnId = column.id;

		const checkboxID = "extra-columns-export-col-" + column.id.replace(/[^A-Za-z0-9_-]/g, "_");
		const checkbox = html("input", { type: "checkbox", id: checkboxID, checked: chosen });
		checkbox.addEventListener("change", () => toggleColumn(column.id, checkbox.checked));
		const label = html("label", { htmlFor: checkboxID, textContent: column.label });
		if (column.combined && !column.label.trim()) {
			localize(label, "extra-columns-export-combined-untitled");
		}
		row.append(checkbox, label);

		if (column.combined) {
			const id = column.combined.definition.id;
			const edit = moveButton("extra-columns-export-combined-edit", "edit", () => openEditor(id));
			edit.disabled = editingID === id;
			row.append(edit);
		}

		const up = moveButton("extra-columns-prefs-move-up", "move-up", () => moveColumn(index, -1));
		up.disabled = !chosen || index === 0;
		const down = moveButton("extra-columns-prefs-move-down", "move-down", () => moveColumn(index, 1));
		down.disabled = !chosen || index === chosenIDs.length - 1;

		row.append(up, down);
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
	// Combined columns
	//

	async function initEditor() {
		const nameInput = byID("extra-columns-export-combined-name");
		const templateInput = byID("extra-columns-export-combined-template");
		for (const input of [nameInput, templateInput]) {
			input.addEventListener("input", onEditorInput);
			// Enter would otherwise press Save.
			input.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.stopPropagation();
					closeEditor();
				}
			});
		}
		byID("extra-columns-export-combined-done").addEventListener("command", closeEditor);
		byID("extra-columns-export-combined-remove").addEventListener("command", removeCombined);

		// Inserts the name that matches first, so "{Brain Function}" rather than a label.
		const menulist = byID("extra-columns-export-insert");
		const popup = menulist.menupopup;
		const placeholder = document.createXULElement("menuitem");
		placeholder.setAttribute("value", "");
		localize(placeholder, "extra-columns-export-insert-field");
		popup.append(placeholder);
		const citekeyLabel = await document.l10n.formatValue("extra-columns-export-col-citekey");
		const choices = [
			...baseColumns.filter((column) => column.field),
			{ label: citekeyLabel, key: "citekey" },
			...baseColumns.filter((column) => !column.field),
		];
		for (const column of choices) {
			const name = column.field ? column.field.key : column.key;
			const item = document.createXULElement("menuitem");
			item.setAttribute("value", name);
			item.setAttribute("label", `${column.label}   {${name}}`);
			popup.append(item);
		}
		menulist.selectedIndex = 0;
		menulist.addEventListener("command", () => {
			if (menulist.value) {
				insertField(menulist.value);
			}
			menulist.selectedIndex = 0;
		});
	}

	function editingDefinition() {
		return combined.find((definition) => definition.id === editingID);
	}

	function saveCombined() {
		api.ExportTable.saveSettings({ combined });
	}

	async function addCombined() {
		const label = await document.l10n.formatValue("extra-columns-export-combined-default-name");
		const definition = { id: api.ExportTable.newCombinedID(combined), label, template: "" };
		combined = [...combined, definition];
		chosenIDs = [...chosenIDs, "combined:" + definition.id];
		buildColumns();
		saveCombined();
		openEditor(definition.id);
	}

	function openEditor(id) {
		editingID = id;
		const definition = editingDefinition();
		if (!definition) {
			return;
		}
		byID("extra-columns-export-combined-name").value = definition.label;
		byID("extra-columns-export-combined-template").value = definition.template;
		setEditorShown(true);
		renderColumns();
		updateEditorStatus();
		byID("extra-columns-export-combined-template").focus();
	}

	function closeEditor() {
		const id = editingID;
		setEditorShown(false);
		renderColumns(id ? { id: "combined:" + id, control: "edit" } : null);
	}

	function setEditorShown(shown) {
		if (!shown) {
			editingID = null;
		}
		byID("extra-columns-export-editor").hidden = !shown;
		dialog.classList.toggle("editing", shown);
		window.sizeToContent();
	}

	function onEditorInput() {
		const definition = editingDefinition();
		if (!definition) {
			return;
		}
		definition.label = byID("extra-columns-export-combined-name").value;
		definition.template = byID("extra-columns-export-combined-template").value;
		buildColumns();
		renderColumns();
		updateEditorStatus();
		saveCombined();
	}

	function insertField(name) {
		const input = byID("extra-columns-export-combined-template");
		const start = input.selectionStart ?? input.value.length;
		const end = input.selectionEnd ?? start;
		input.setRangeText(`{${name}}`, start, end, "end");
		input.focus();
		onEditorInput();
	}

	function removeCombined() {
		const id = editingID;
		combined = combined.filter((definition) => definition.id !== id);
		chosenIDs = chosenIDs.filter((chosenID) => chosenID !== "combined:" + id);
		setEditorShown(false);
		buildColumns();
		renderColumns();
		saveCombined();
	}

	/** The template's problem, or what it gives for the first item. */
	function updateEditorStatus() {
		const column = columns.find((candidate) => candidate.id === "combined:" + editingID);
		if (!column) {
			return;
		}
		const status = byID("extra-columns-export-combined-status");
		const { error } = column.combined;
		status.classList.toggle("extra-columns-export-error", !!error);
		if (error) {
			localize(status, "extra-columns-export-template-" + error.code, { name: error.name || "" });
			return;
		}
		const [value] = api.ExportTable.rows(items.slice(0, 1), [column])[0];
		localize(status, value ? "extra-columns-export-combined-preview" : "extra-columns-export-combined-preview-empty",
			{ value });
	}

	//
	// Output
	//

	function tableText(format) {
		const byColumnID = new Map(columns.map((column) => [column.id, column]));
		const chosen = chosenIDs.map((id) => byColumnID.get(id));
		return format.serialize(chosen, api.ExportTable.rows(items, chosen, format.escape));
	}

	function remember(format) {
		api.ExportTable.saveSettings({ format: format.id, columnIDs: chosenIDs, combined, layout: layoutName });
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
		await Zotero.File.putContentsAsync(picker.file, (format.bom ? "﻿" : "") + tableText(format));
		remember(format);
		return true;
	}

	return { init };
})();

// Settles when the dialog is set up, or fails. The test script waits on it.
ExtraColumnsExport.ready = new Promise((resolve, reject) => {
	window.addEventListener("load", () => {
		ExtraColumnsExport.init().then(resolve, (e) => {
			Zotero.logError(e);
			reject(e);
			window.close();
		});
	}, { once: true });
});
ExtraColumnsExport.ready.catch(() => {});
