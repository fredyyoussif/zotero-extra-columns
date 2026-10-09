/*
 * Ties the pieces together: registers columns and Info rows from the field
 * definitions, and registers them again whenever the definitions change.
 */

/* global Zotero, FieldConfig, Columns, InfoRows */

var ExtraColumns = (function () {
	"use strict";

	let pluginID = null;
	let prefObserverID = null;
	let skippedFieldIDs = [];

	async function init(options) {
		pluginID = options.pluginID;
		registerAll();
		prefObserverID = Zotero.Prefs.registerObserver(FieldConfig.PREF, () => reconcile(), true);

		try {
			await Zotero.PreferencePanes.register({
				pluginID,
				label: "Extra Columns",
				src: options.rootURI + "content/preferences.xhtml",
				scripts: [options.rootURI + "content/preferences.js"],
				stylesheets: [options.rootURI + "content/preferences.css"],
			});
		}
		catch (e) {
			Zotero.logError(e);
		}
	}

	function registerAll() {
		const usable = [];
		skippedFieldIDs = [];
		for (const field of FieldConfig.load()) {
			// A future Zotero version could start using a key for its own data.
			if (FieldConfig.isReservedKey(field.key)) {
				skippedFieldIDs.push(field.id);
				Zotero.debug(`Extra Columns: skipping "${field.key}" because Zotero now uses this key`);
				continue;
			}
			usable.push(field);
		}
		Columns.register(usable, pluginID);
		InfoRows.register(usable, pluginID);
	}

	function unregisterAll() {
		Columns.unregisterAll();
		InfoRows.unregisterAll();
	}

	/** Column ids are stable, so widths and visibility survive this. */
	function reconcile() {
		try {
			unregisterAll();
			registerAll();
		}
		catch (e) {
			Zotero.logError(e);
		}
	}

	function shutdown() {
		if (prefObserverID !== null) {
			Zotero.Prefs.unregisterObserver(prefObserverID);
			prefObserverID = null;
		}
		unregisterAll();
	}

	return {
		init,
		shutdown,
		reconcile,
		getSkippedFieldIDs: () => skippedFieldIDs.slice(),
	};
})();
