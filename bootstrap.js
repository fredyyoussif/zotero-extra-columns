/*
 * Extra Columns: user-defined Zotero columns stored in the Extra field.
 *
 * This file only handles the plugin lifecycle. The work happens in content/*.js,
 * which are loaded into this scope and share its globals.
 */

/* global Zotero, Services, Components */

var ExtraFields, FieldConfig, ItemData, Columns, InfoRows, Detect, ExportFormats, ExportTemplate, ExportTable, ExtraColumns;

// Load order matters: later scripts use the objects defined by earlier ones.
var CONTENT_SCRIPTS = [
	"extra-fields.js",
	"field-config.js",
	"item-data.js",
	"columns.js",
	"info-rows.js",
	"detect.js",
	"export-formats.js",
	"export-template.js",
	"export-table.js",
	"main.js",
];
var FTL_FILE = "extra-columns.ftl";
var APP_SHUTDOWN_REASON = 2;
var chromeHandle = null;

function install() {}

async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;

	// Serves the export dialog at chrome://extra-columns/content/.
	const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
		.getService(Components.interfaces.amIAddonManagerStartup);
	chromeHandle = aomStartup.registerChrome(Services.io.newURI(rootURI + "manifest.json"), [
		["content", "extra-columns", "content/"],
	]);

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
		ExportFormats,
		ExportTemplate,
		ExportTable,
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
	if (chromeHandle) {
		chromeHandle.destruct();
		chromeHandle = null;
	}
	delete Zotero.ExtraColumns;
	ExtraFields = FieldConfig = ItemData = Columns = InfoRows = Detect = ExportFormats = ExportTemplate = ExportTable = ExtraColumns = undefined;
}

// Field definitions and item data are kept, so reinstalling restores everything.
function uninstall() {}

function addToWindow(win) {
	win.MozXULElement.insertFTLIfNeeded(FTL_FILE);
}

function removeFromWindow(win) {
	win.document.querySelector(`link[href="${FTL_FILE}"]`)?.remove();
}
