/*
 * Ties the pieces together: registers columns and Info rows from the field
 * definitions, registers them again whenever the definitions change, and adds
 * Export as Table to the item menu.
 */

/* global Zotero, FieldConfig, Columns, InfoRows, ExportTable */

var ExtraColumns = (function () {
	"use strict";

	const EXPORT_DIALOG_URL = "chrome://extra-columns/content/export.xhtml";

	let pluginID = null;
	let prefObserverID = null;
	let exportMenuID = null;
	let skippedFieldIDs = [];

	async function init(options) {
		pluginID = options.pluginID;
		registerAll();
		prefObserverID = Zotero.Prefs.registerObserver(FieldConfig.PREF, () => reconcile(), true);
		registerExportMenu();

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

	/** "Export as Table..." in the item list's context menu. */
	function registerExportMenu() {
		try {
			exportMenuID = Zotero.MenuManager.registerMenu({
				menuID: "extra-columns-export",
				pluginID,
				target: "main/library/item",
				menus: [{
					menuType: "menuitem",
					l10nID: "extra-columns-export-menu",
					onShowing: (event, context) => {
						context.setVisible(ExportTable.exportableItems(context.items || []).length > 0);
					},
					onCommand: (event, context) => openExportDialog(event.target.ownerGlobal, context.items || []),
				}],
			}) || null;
		}
		catch (e) {
			Zotero.logError(e);
		}
		if (!exportMenuID) {
			Zotero.logError(new Error("Extra Columns: could not add Export as Table to the item menu"));
		}
	}

	function openExportDialog(win, selected) {
		const items = ExportTable.exportableItems(selected);
		if (!items.length) {
			return;
		}
		win.openDialog(EXPORT_DIALOG_URL, "", "chrome,dialog,centerscreen,resizable", {
			items,
			skippedCount: selected.length - items.length,
		});
	}

	function shutdown() {
		if (prefObserverID !== null) {
			Zotero.Prefs.unregisterObserver(prefObserverID);
			prefObserverID = null;
		}
		if (exportMenuID) {
			try {
				Zotero.MenuManager.unregisterMenu(exportMenuID);
			}
			catch (e) {
				Zotero.logError(e);
			}
			exportMenuID = null;
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
