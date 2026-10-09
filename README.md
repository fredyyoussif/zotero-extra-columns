# Extra Columns

A Zotero 10 plugin that lets you add your own columns to the item list. You can sort by them, and you edit their values in the item pane's **Info** section, just like Title or Date.

Each value is saved as a `Key: value` line in the item's **Extra** field. Extra is an ordinary Zotero field, so your values sync to zotero.org and to your other computers with the rest of your library.

## Installing

1. Build the plugin by running this in PowerShell from this folder:

   ```powershell
   .\build.ps1
   ```

   This creates `extra-columns.xpi`.
2. In Zotero, open **Tools > Plugins**, click the gear menu, and choose **Install Plugin From File...**.
3. Select `extra-columns.xpi`.

The plugin needs Zotero 10.

## Adding columns

1. Open **Edit > Settings** (on macOS, **Zotero > Settings**) and select **Extra Columns**.
2. Type a column name, for example `Reading status`. The Extra key fills in from the name, and you can change it before adding.
3. Tick **Number** if the column holds numbers.
4. Click **Add field**.
5. Right-click any column header in the item list and tick your new column. New columns start hidden.

In Settings you can rename a column, switch it between text and number, reorder it, or remove it. The Extra key can't be changed after a column is added. To use a different key, remove the column and add a new one.

Removing a column or changing its type never changes your items. Their Extra lines stay where they are.

## Editing values

Select an item and find your columns as rows near the bottom of the **Info** section. Click a value to edit it. The item list updates as soon as you leave the field.

- **Clearing** a value removes its line from Extra.
- **Editing Extra by hand** works too. The column reads whatever line is there.
- **Batch editing** works. Select several items, turn on batch editing in the item pane, and type a value to set it on all of them. If the items have different values, the row shows empty. Leaving it empty changes nothing.
- **Notes and attachments** have no Extra field, so their cells stay blank and the rows don't appear.

## Number columns

- Numbers can be whole or decimal, and negative. Examples: `3`, `-1.5`, `0.25`.
- Values are tidied when saved. For example, `1.50` is stored as `1.5` and `007` as `7`.
- Text that isn't a number is rejected, and the previous value comes back.
- Sorting is numeric. Empty cells come last. Values that aren't numbers, for example typed by hand into Extra, sort after all the numbers.
- Up to 15 digits before the decimal point and 10 after are supported.

## How values are stored

A column called **Reading status** with the key `Reading Status` stores this line in Extra:

```
Reading Status: to read
```

- Other lines in Extra are left exactly as they are.
- Keys match regardless of case, spaces, hyphens and underscores, the same way Zotero matches its own Extra keys. `readingStatus: done` is read as Reading Status.
- When a value is saved, any duplicate lines for that key are removed.
- Values must fit on one line. Line breaks are turned into spaces.

### Keys Zotero already uses

Zotero reads some Extra lines as its own data. Examples are `Archive: ...`, `Language: ...` and `Editor: ...`. Zotero would take over a line like that, or move it into a real field during an update. The plugin therefore refuses any key that Zotero recognises. If a future Zotero version starts using one of your keys, that column is hidden and Settings shows a warning.

## Setting up another computer

Values sync through Extra, but the list of columns is stored on each computer.

1. Install the plugin on the other computer.
2. Open **Settings > Extra Columns** and click **Detect from library**. It lists every `Key: value` line in Extra that Zotero doesn't use itself, with how many items have it and an example value.
3. Tick the keys you want, tick **Number** where needed, and click **Add selected**.

Detection also finds lines written by other tools, such as `citationCount: 00000123`.

## Limitations

- **Values are edited in the Info section, not in the list.** Zotero 10 has no supported way for plugins to edit list cells.
- **All columns share the Extra field.** Suppose two computers edit different columns of the same item before either syncs. Zotero sees one conflicting field, Extra, and asks which version to keep.
- **Citations may show these lines.** Zotero passes Extra text it doesn't recognise to citation styles as the "note" variable, and a few styles print it.
- **Column definitions don't sync.** Use **Detect from library** on each computer.

## Development

| File | Purpose |
|---|---|
| `bootstrap.js` | Plugin startup and shutdown |
| `content/extra-fields.js` | Reading and writing Extra lines; number checks and sort keys. No Zotero dependencies. |
| `content/field-config.js` | Column definitions, stored as JSON in the `extensions.extra-columns.fields` preference |
| `content/item-data.js` | Reading and saving values on items |
| `content/columns.js` | Item list columns |
| `content/info-rows.js` | Editable rows in the Info section, including batch editing |
| `content/detect.js` | Finds existing Extra keys for **Detect from library** |
| `content/main.js` | Registers everything and re-registers when columns change |
| `content/preferences.*` | The Settings pane |
| `locale/en-US/extra-columns.ftl` | Interface text |

### Running the tests

1. Install and enable the plugin.
2. Open **Tools > Developer > Run JavaScript** and tick **Run as async function**.
3. Paste the contents of `test/extra-fields.tests.js` and click **Run**.

The first line of the result says how many checks passed. The tests only read data. They don't change items or settings.

### Troubleshooting

Turn on **Help > Debug Output Logging** and look for lines starting with `Extra Columns`. Errors also appear in **Tools > Developer > Error Console**.

### Before sharing the plugin

The plugin ID `extra-columns@local.plugin` and the update URL in `manifest.json` are placeholders. Replace both before distributing the plugin. Changing the ID resets saved column widths and visibility.
