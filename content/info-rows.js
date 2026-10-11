/*
 * One editable row per field in the item pane's Info section.
 *
 * Zotero 10 notes that shape this file:
 * - The Info box calls onSetData on every blur, even when nothing changed.
 * - In batch editing, the hooks receive only the first selected item. The other
 *   items are on the Info section's <info-box> element, in its `extraItems` property.
 */

/* global Zotero, ExtraFields, ItemData */

var InfoRows = (function () {
	"use strict";

	// This message has only a tooltip attribute, so Fluent keeps the plain-text label.
	const LABEL_L10N_ID = "extra-columns-field-label";

	let registeredIDs = [];
	// The Info box keeps an existing row element when a row with the same ID is
	// registered again, so it would keep the old label and position. A new ID on
	// every registration makes it rebuild the rows after a rename or reorder.
	let generation = 0;

	/** All items being edited: the batch in the library tab, otherwise just this item. */
	function editedItems(item, tabType) {
		if (!item) {
			return [];
		}
		if (tabType && tabType !== "library") {
			return [item];
		}
		for (const win of Zotero.getMainWindows()) {
			for (const box of win.document.querySelectorAll("info-box")) {
				const extraItems = box.extraItems;
				if (box.item && box.item.id === item.id && Array.isArray(extraItems) && extraItems.length) {
					return [box.item, ...extraItems];
				}
			}
		}
		return [item];
	}

	function getData(field, { item, tabType }) {
		return ItemData.sharedValue(editedItems(item, tabType), field);
	}

	function setData(field, { rowID, item, tabType, value: typed }) {
		const items = editedItems(item, tabType);
		let value = ExtraFields.sanitizeValue(typed);

		if (field.type === "number" && value !== "") {
			const canonical = ExtraFields.canonicalNumber(value);
			if (canonical === null) {
				showInvalidNumber(field).catch((e) => Zotero.logError(e));
				restoreRow(rowID);
				return;
			}
			value = canonical;
		}

		// Unchanged: don't save. This also keeps an untouched mixed-value batch intact.
		if (value === ItemData.sharedValue(items, field)) {
			if (value !== typed) {
				restoreRow(rowID);
			}
			return;
		}

		ItemData.writeValue(items, field, value).catch((e) => {
			Zotero.logError(e);
			restoreRow(rowID);
		});
	}

	function itemChanged({ item, setEnabled, setEditable }) {
		const eligible = ItemData.isEligible(item);
		setEnabled(eligible);
		setEditable(eligible && ItemData.isEditable(item));
	}

	/** Show the stored value again after the editor closes. */
	function restoreRow(rowID) {
		Zotero.Promise.delay(0)
			.then(() => Zotero.ItemPaneManager.refreshInfoRow(rowID))
			.catch((e) => Zotero.logError(e));
	}

	async function showInvalidNumber(field) {
		let title = "Not a number";
		let message = `${field.label} must be a number, for example 3 or -1.5.`;
		try {
			const doc = Zotero.getMainWindow().document;
			const [formattedTitle, formattedMessage] = await doc.l10n.formatValues([
				{ id: "extra-columns-invalid-number-title" },
				{ id: "extra-columns-invalid-number", args: { label: field.label } },
			]);
			title = formattedTitle || title;
			message = formattedMessage || message;
		}
		catch (e) {
			Zotero.debug(`Extra Columns: using fallback text for the number warning: ${e}`);
		}
		const progress = new Zotero.ProgressWindow({ closeOnClick: true });
		progress.changeHeadline(title);
		progress.addDescription(message);
		progress.show();
		progress.startCloseTimer(5000);
	}

	function register(fields, pluginID) {
		generation++;
		for (const field of fields) {
			let rowID = false;
			try {
				rowID = Zotero.ItemPaneManager.registerInfoRow({
					rowID: `f-${field.id}-${generation}`,
					pluginID,
					label: { l10nID: LABEL_L10N_ID, text: field.label },
					position: "end",
					multiline: false,
					nowrap: false,
					editable: true,
					onGetData: (args) => getData(field, args),
					onSetData: (args) => setData(field, args),
					onItemChange: itemChanged,
				});
			}
			catch (e) {
				Zotero.logError(e);
			}
			if (rowID) {
				registeredIDs.push(rowID);
			}
			else {
				Zotero.logError(new Error(`Extra Columns: could not register an Info row for "${field.key}"`));
			}
		}
	}

	function unregisterAll() {
		for (const rowID of registeredIDs) {
			try {
				Zotero.ItemPaneManager.unregisterInfoRow(rowID);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		registeredIDs = [];
	}

	return { register, unregisterAll };
})();
