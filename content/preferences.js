/*
 * Settings pane for Extra Columns. Runs in the Settings window and uses the
 * plugin's logic through Zotero.ExtraColumns.
 */

/* global Zotero, document, MutationObserver */

var ExtraColumnsPrefs = (function () {
	"use strict";

	const HTML_NS = "http://www.w3.org/1999/xhtml";
	const initializedRoots = new WeakSet();

	let api = null;
	let fields = [];
	let candidates = [];
	let keyEditedByUser = false;

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

	function button(l10nID, onCommand) {
		const element = document.createXULElement("button");
		localize(element, l10nID);
		element.addEventListener("command", onCommand);
		return element;
	}

	function init(root) {
		if (initializedRoots.has(root)) {
			return;
		}
		initializedRoots.add(root);

		api = Zotero.ExtraColumns;
		if (!api) {
			showError("extra-columns-prefs-unavailable");
			for (const id of ["extra-columns-add", "extra-columns-detect"]) {
				byID(id).disabled = true;
			}
			return;
		}

		fields = api.FieldConfig.load();

		byID("extra-columns-new-label").addEventListener("input", onNewLabelInput);
		byID("extra-columns-new-key").addEventListener("input", (event) => {
			keyEditedByUser = event.target.value !== "";
		});
		for (const id of ["extra-columns-new-label", "extra-columns-new-key"]) {
			byID(id).addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					onAdd();
				}
			});
		}
		byID("extra-columns-add").addEventListener("command", onAdd);
		byID("extra-columns-detect").addEventListener("command", onDetect);
		byID("extra-columns-detect-add").addEventListener("command", onAddDetected);

		renderFields();
	}

	//
	// Field list
	//

	/** Save the definitions. The plugin's pref observer re-registers columns right away. */
	function commit(newFields) {
		fields = newFields;
		api.FieldConfig.save(fields);
		renderFields();
	}

	function renderFields() {
		const tbody = byID("extra-columns-rows");
		tbody.replaceChildren();
		const skipped = new Set(api.getSkippedFieldIDs());

		fields.forEach((field, index) => {
			const row = html("tr");

			const labelInput = html("input", { type: "text", value: field.label });
			localize(labelInput, "extra-columns-prefs-label-input", { key: field.key });
			labelInput.addEventListener("change", () => renameField(field.id, labelInput));
			const labelCell = html("td");
			labelCell.append(labelInput);
			if (skipped.has(field.id)) {
				labelCell.append(localize(html("div", { className: "extra-columns-warning" }), "extra-columns-error-skipped"));
			}

			const keyCell = html("td", { className: "extra-columns-key", textContent: field.key });

			const numberBox = html("input", { type: "checkbox", checked: field.type === "number" });
			localize(numberBox, "extra-columns-prefs-number-input", { key: field.key });
			numberBox.addEventListener("change", () => setType(field.id, numberBox.checked ? "number" : "text"));
			const numberCell = html("td", { className: "extra-columns-narrow" });
			numberCell.append(numberBox);

			const up = button("extra-columns-prefs-move-up", () => moveField(index, -1));
			up.disabled = index === 0;
			const down = button("extra-columns-prefs-move-down", () => moveField(index, 1));
			down.disabled = index === fields.length - 1;
			const remove = button("extra-columns-prefs-remove", () => removeField(field.id));
			const actionsCell = html("td", { className: "extra-columns-actions" });
			actionsCell.append(up, down, remove);

			row.append(labelCell, keyCell, numberCell, actionsCell);
			tbody.append(row);
		});

		byID("extra-columns-empty").hidden = fields.length > 0;
	}

	function renameField(id, input) {
		const field = fields.find((f) => f.id === id);
		const label = input.value.trim();
		if (!field) {
			return;
		}
		if (!label) {
			input.value = field.label;
			return;
		}
		if (label !== field.label) {
			commit(fields.map((f) => (f.id === id ? { ...f, label } : f)));
		}
	}

	function setType(id, type) {
		commit(fields.map((f) => (f.id === id ? { ...f, type } : f)));
	}

	function moveField(index, delta) {
		const target = index + delta;
		if (target < 0 || target >= fields.length) {
			return;
		}
		const reordered = fields.slice();
		[reordered[index], reordered[target]] = [reordered[target], reordered[index]];
		commit(reordered);
	}

	function removeField(id) {
		commit(fields.filter((f) => f.id !== id));
	}

	//
	// New field
	//

	function onNewLabelInput() {
		if (!keyEditedByUser) {
			byID("extra-columns-new-key").value = api.ExtraFields.suggestKeyFromLabel(byID("extra-columns-new-label").value);
		}
	}

	function onAdd() {
		const labelInput = byID("extra-columns-new-label");
		const keyInput = byID("extra-columns-new-key");
		const numberBox = byID("extra-columns-new-number");

		const label = labelInput.value.trim();
		const key = keyInput.value.trim() || api.ExtraFields.suggestKeyFromLabel(label);
		const error = api.FieldConfig.validateNewKey(fields, key);
		if (error) {
			showError(error.l10nID, error.args);
			return;
		}

		const type = numberBox.checked ? "number" : "text";
		commit([...fields, api.FieldConfig.createField(fields, { label, key, type })]);

		labelInput.value = "";
		keyInput.value = "";
		numberBox.checked = false;
		keyEditedByUser = false;
		showError(null);
		labelInput.focus();
	}

	function showError(l10nID, args) {
		const element = byID("extra-columns-error");
		if (!l10nID) {
			element.hidden = true;
			element.removeAttribute("data-l10n-id");
			element.removeAttribute("data-l10n-args");
			element.textContent = "";
			return;
		}
		element.hidden = false;
		localize(element, l10nID, args);
	}

	//
	// Detection
	//

	async function onDetect() {
		const detectButton = byID("extra-columns-detect");
		const status = byID("extra-columns-detect-status");
		detectButton.disabled = true;
		localize(status, "extra-columns-prefs-detect-running");
		try {
			candidates = await api.Detect.findCandidates(fields);
			if (candidates.length) {
				localize(status, "extra-columns-prefs-detect-found", { count: candidates.length });
			}
			else {
				localize(status, "extra-columns-prefs-detect-none");
			}
		}
		catch (e) {
			Zotero.logError(e);
			candidates = [];
			localize(status, "extra-columns-prefs-detect-failed");
		}
		finally {
			detectButton.disabled = false;
		}
		renderCandidates();
	}

	function renderCandidates() {
		const tbody = byID("extra-columns-detect-rows");
		tbody.replaceChildren();

		for (const candidate of candidates) {
			const row = html("tr");

			const selectBox = html("input", { type: "checkbox", className: "extra-columns-detect-select" });
			localize(selectBox, "extra-columns-prefs-detect-select", { key: candidate.key });
			const selectCell = html("td", { className: "extra-columns-narrow" });
			selectCell.append(selectBox);

			const keyCell = html("td", { className: "extra-columns-key", textContent: candidate.key });
			const countCell = html("td", { className: "extra-columns-narrow", textContent: String(candidate.count) });
			const sampleCell = html("td", {
				className: "extra-columns-sample",
				textContent: candidate.sample,
				title: candidate.sample,
			});

			const numberBox = html("input", {
				type: "checkbox",
				className: "extra-columns-detect-number",
				checked: candidate.suggestedType === "number",
			});
			localize(numberBox, "extra-columns-prefs-number-input", { key: candidate.key });
			const numberCell = html("td", { className: "extra-columns-narrow" });
			numberCell.append(numberBox);

			row.dataset.key = candidate.key;
			row.append(selectCell, keyCell, countCell, sampleCell, numberCell);
			tbody.append(row);
		}

		byID("extra-columns-detect-table").hidden = candidates.length === 0;
		byID("extra-columns-detect-add").hidden = candidates.length === 0;
	}

	function onAddDetected() {
		let updated = fields.slice();
		const added = new Set();

		for (const row of byID("extra-columns-detect-rows").children) {
			if (!row.querySelector(".extra-columns-detect-select").checked) {
				continue;
			}
			const key = row.dataset.key;
			if (api.FieldConfig.validateNewKey(updated, key)) {
				continue;
			}
			const type = row.querySelector(".extra-columns-detect-number").checked ? "number" : "text";
			updated = [...updated, api.FieldConfig.createField(updated, { label: key, key, type })];
			added.add(key);
		}

		if (!added.size) {
			return;
		}
		commit(updated);
		candidates = candidates.filter((candidate) => !added.has(candidate.key));
		renderCandidates();
	}

	return { init };
})();

// The pane's markup may be inserted before or after this script runs.
(function () {
	function tryInit() {
		const root = document.getElementById("extra-columns-prefs");
		if (!root) {
			return false;
		}
		ExtraColumnsPrefs.init(root);
		return true;
	}

	if (!tryInit()) {
		const observer = new MutationObserver(() => {
			if (tryInit()) {
				observer.disconnect();
			}
		});
		observer.observe(document.documentElement, { childList: true, subtree: true });
	}
})();
