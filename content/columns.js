/*
 * One item-list column per field. The item list has no cell editing in Zotero 10,
 * so values are edited in the Info section (see info-rows.js).
 */

/* global Zotero, ExtraFields, ItemData */

var Columns = (function () {
	"use strict";

	let registeredKeys = [];

	/**
	 * Zotero uses this value both for display and for sorting.
	 * Number columns return a sort key; renderNumberCell shows the raw value.
	 */
	function cellData(item, field) {
		const value = ItemData.readValue(item, field);
		return field.type === "number" ? ExtraFields.numberSortKey(value) : value;
	}

	function renderNumberCell(index, data, column, isFirstColumn, doc) {
		const cell = doc.createElement("span");
		cell.className = `cell ${column.className || ""}`;
		cell.textContent = ExtraFields.displayFromSortKey(data || "");
		cell.style.textAlign = "end";
		return cell;
	}

	function register(fields, pluginID) {
		for (const field of fields) {
			const options = {
				dataKey: "f-" + field.id,
				label: field.label,
				pluginID,
				enabledTreeIDs: ["main"],
				minWidth: 40,
				zoteroPersist: ["width", "hidden", "sortDirection"],
				dataProvider: (item) => cellData(item, field),
			};
			if (field.type === "number") {
				options.renderCell = renderNumberCell;
			}

			let key = false;
			try {
				key = Zotero.ItemTreeManager.registerColumn(options);
			}
			catch (e) {
				Zotero.logError(e);
			}
			if (key) {
				registeredKeys.push(key);
			}
			else {
				Zotero.logError(new Error(`Extra Columns: could not register a column for "${field.key}"`));
			}
		}
	}

	function unregisterAll() {
		for (const key of registeredKeys) {
			try {
				Zotero.ItemTreeManager.unregisterColumn(key);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		registeredKeys = [];
	}

	return { register, unregisterAll };
})();
