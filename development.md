# Development

| File | Purpose |
|---|---|
| `bootstrap.js` | Plugin startup and shutdown |
| `content/extra-fields.js` | Reading and writing Extra lines; number checks and sort keys. No Zotero dependencies. |
| `content/field-config.js` | Column definitions, stored as JSON in the `extensions.extra-columns.fields` preference |
| `content/item-data.js` | Reading and saving values on items |
| `content/columns.js` | Item list columns |
| `content/info-rows.js` | Editable rows in the Info section, including batch editing |
| `content/detect.js` | Finds existing Extra keys for **Detect from library** |
| `content/export-formats.js` | Output formats for **Export as Table**. To add a format, add an entry to `FORMATS` and a label to the locale file. No Zotero dependencies. |
| `content/export-table.js` | The columns and cell values for **Export as Table**, and the choices it remembers in `extensions.extra-columns.export` |
| `content/export.*` | The **Export as Table** dialog, served from `chrome://extra-columns/content/` |
| `content/main.js` | Registers everything, re-registers when columns change, and adds the item menu entry |
| `content/preferences.*` | The Settings pane |
| `locale/en-US/extra-columns.ftl` | Interface text |

## Building

The version number isn't stored anywhere in the repository. `manifest.json` and `updates.json` are templates with a `{{VERSION}}` placeholder, and the build fills it in. To build locally, pass a version:

```bash
bash build.sh 0.1.2
```

This creates `extra-columns.xpi` and `updates.json` in the `build` folder. It needs `zip` and `sha256sum`, which Linux has. Git Bash on Windows doesn't include `zip`, so use WSL there or let GitHub Actions build.

GitHub Actions builds on every push and keeps the result as a workflow artifact. Builds that aren't from a tag get version `0.0.0`.

To publish a release, push a tag named `v` followed by the version:

```
git tag v0.1.2
git push origin v0.1.2
```

The workflow builds with the version from the tag, then creates a release with `extra-columns.xpi` and `updates.json` attached. A tag that isn't `v` plus numbers separated by dots fails the build.

Zotero checks the `updates.json` on the latest release, through the manifest's `update_url`, and offers installed copies the new version. Keep the plugin ID in `manifest.json` unchanged from now on, because Zotero matches updates by ID.

## Running the tests

1. Install and enable the plugin.
2. Open **Tools > Developer > Run JavaScript** and tick **Run as async function**.
3. Paste the contents of `test/extra-fields.tests.js` and click **Run**.

The first line of the result says how many checks passed. The tests only read data. They don't change items or settings.

## Troubleshooting

Turn on **Help > Debug Output Logging** and look for lines starting with `Extra Columns`. Errors also appear in **Tools > Developer > Error Console**.

