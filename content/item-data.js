/*
 * Reading and writing custom field values on Zotero items.
 */

/* global Zotero, ExtraFields */

var ItemData = (function () {
	"use strict";

	/** Regular items whose type has an Extra field. Notes and attachments are excluded. */
	function isEligible(item) {
		try {
			return !!item
				&& item.isRegularItem()
				&& Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID("extra"), item.itemTypeID);
		}
		catch (e) {
			return false;
		}
	}

	function isEditable(item) {
		if (!item || item.deleted) {
			return false;
		}
		try {
			if (typeof item.isEditable === "function") {
				return item.isEditable();
			}
			return !!Zotero.Libraries.get(item.libraryID).editable;
		}
		catch (e) {
			return false;
		}
	}

	function readValue(item, field) {
		if (!isEligible(item)) {
			return "";
		}
		return ExtraFields.getValue(item.getField("extra"), field.key);
	}

	/** The value all items share, or "" when they differ. */
	function sharedValue(items, field) {
		const eligible = items.filter(isEligible);
		if (!eligible.length) {
			return "";
		}
		const first = readValue(eligible[0], field);
		return eligible.every((item) => readValue(item, field) === first) ? first : "";
	}

	/**
	 * Set the field on every eligible, editable item whose value differs.
	 * All changes are saved in one transaction. Resolves to the number of items changed.
	 */
	async function writeValue(items, field, value) {
		const targets = items.filter(
			(item) => isEligible(item) && isEditable(item) && readValue(item, field) !== value
		);
		if (!targets.length) {
			return 0;
		}
		await Zotero.DB.executeTransaction(async () => {
			for (const item of targets) {
				item.setField("extra", ExtraFields.setValue(item.getField("extra"), field.key, value));
				await item.save();
			}
		});
		return targets.length;
	}

	return { isEligible, isEditable, readValue, sharedValue, writeValue };
})();
