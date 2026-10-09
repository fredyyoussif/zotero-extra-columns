/*
 * Extra Columns: user-defined Zotero columns stored in the Extra field.
 *
 * This file only handles the plugin lifecycle. The work happens in content/*.js,
 * which are loaded into this scope and share its globals.
 */

/* global Zotero, Services */

var ExtraFields, FieldConfig, ItemData, Columns, InfoRows, Detect, ExtraColumns;

// Load order matters: later scripts use the objects defined by earlier ones.
var CONTENT_SCRIPTS = [
	"extra-fields.js",
	"field-config.js",
	"item-data.js",
	"columns.js",
	"info-rows.js",
	"detect.js",
	"main.js",
];
var FTL_FILE = "extra-columns.ftl";
var APP_SHUTDOWN_REASON = 2;

function install() {}

async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;

	for (const file of CONTENT_SCRIPTS) {
		Services.scriptloader.loadSubScript(rootURI + "content/" + file);
	}

	// Used by the preferences pane and the test script.
	Zotero.ExtraColumns = {
		version,
		ExtraFields,
		FieldConfig,
		ItemData,
		Detect,
		getSkippedFieldIDs: () => ExtraColumns.getSkippedFieldIDs(),
		reconcile: () => ExtraColumns.reconcile(),
	};

	await ExtraColumns.init({ pluginID: id, rootURI });

	for (const win of Zotero.getMainWindows()) {
		addToWindow(win);
	}
	Zotero.debug(`Extra Columns ${version}: started`);
}

function onMainWindowLoad({ window }) {
	addToWindow(window);
}

function onMainWindowUnload({ window }) {
	removeFromWindow(window);
}

function shutdown(data, reason) {
	// Zotero is quitting; it removes plugin registrations itself.
	if (reason === APP_SHUTDOWN_REASON) {
		return;
	}
	if (ExtraColumns) {
		ExtraColumns.shutdown();
	}
	for (const win of Zotero.getMainWindows()) {
		removeFromWindow(win);
	}
	delete Zotero.ExtraColumns;
	ExtraFields = FieldConfig = ItemData = Columns = InfoRows = Detect = ExtraColumns = undefined;
}

// Field definitions and item data are kept, so reinstalling restores everything.
function uninstall() {}

function addToWindow(win) {
	win.MozXULElement.insertFTLIfNeeded(FTL_FILE);
}

function removeFromWindow(win) {
	win.document.querySelector(`link[href="${FTL_FILE}"]`)?.remove();
}
