# Extra Columns

A Zotero 10 plugin that lets you add your own columns to the item list. You can sort by them, and you edit their values in the item pane's **Info** section, just like Title or Date.

Each value is saved as a `Key: value` line in the item's **Extra** field. Extra is an ordinary Zotero field, so your values sync to zotero.org and to your other computers with the rest of your library.

## Installing

1. Download [`extra-columns.xpi`](https://github.com/fredyyoussif/zotero-extra-columns/releases/latest/download/extra-columns.xpi) from the [latest release](https://github.com/fredyyoussif/zotero-extra-columns/releases/latest).
   In Firefox, right-click the link and choose **Save Link As...**, or Firefox will try to install the file as a browser add-on.
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

## Exporting a table

1. Select the items in the item list, right-click, and choose **Export as Table...**.
2. Pick a **Format**: Markdown table, LaTeX table or CSV.
3. Tick the columns you want. Your own columns are listed first, then Zotero's, including some that aren't item-list columns, such as **All Creators**, **Citation (@key)**, **Citation (\cite{key})**, **DOI**, **URL** and **Abstract**.
4. Use **Up** and **Down** to set the column order. Ticked columns are listed in the order they'll appear.
5. Click **Copy to clipboard**, or **Save...** to write a file.

The first time, the dialog ticks the columns showing in the item list, in the same order. After that it remembers your last choice. Click **Match item list** to go back to the item list's columns.

- Each selected item becomes one row. Notes and attachments are left out.
- Values look the same as in the item list. Dates use your computer's date format, and number columns are right-aligned.
- **Citation (@key)** gives a Pandoc-style citation such as `@smith_climate_2020`, for writing in Markdown. It uses the same key as Zotero's BibTeX export: a `Citation Key: ...` line in Extra, then Zotero's **Citation Key** field, then [Better BibTeX](https://retorque.re/zotero-better-bibtex/)'s key if it's installed. Otherwise it builds the key the BibTeX export would, from the first author's last name, the first significant title word and the year. If two items in one export get the same built key, the later ones get `-1`, `-2` and so on, as in the BibTeX export.
- **Citation (\cite{key})** gives the same key as a LaTeX citation, such as `\cite{smith_climate_2020}`.
- **Markdown:** line breaks, for example in an abstract, become spaces. `|` characters are escaped so they don't break the table.
- **LaTeX:** the table is a `tabular` you can paste into a `table` environment. Line breaks become spaces. Characters such as `&`, `%`, `_` and `$` are escaped so they print as typed. **Citation (\cite{key})** is left as it is so the citation works.
- **CSV:** cells holding commas, quotes or line breaks are quoted, and line breaks are kept. Saved files start with a byte order mark so Excel reads accented characters correctly.

## Setting up another computer

Values sync through Extra, but the list of columns is stored on each computer.

1. Install the plugin on the other computer.
2. Open **Settings > Extra Columns** and click **Detect from library**. It lists every `Key: value` line in Extra that Zotero doesn't use itself, with how many items have it and an example value.
3. Tick the keys you want, tick **Number** where needed, and click **Add selected**.

Detection also finds lines written by other tools.

## Limitations

- **Values are edited in the Info section, not in the list.** Zotero 10 has no supported way for plugins to edit list cells.
- **All columns share the Extra field.** Suppose two computers edit different columns of the same item before either syncs. Zotero sees one conflicting field, Extra, and asks which version to keep.
- **Citations may show these lines.** Zotero passes Extra text it doesn't recognise to citation styles as the "note" variable, and a few styles print it.
- **Column definitions don't sync.** Use **Detect from library** on each computer.

## Development

See [development.md](development.md) for the file layout, building, releasing, running the tests and troubleshooting.

## Licence

Extra Columns is free software, released under the [GNU Affero General Public License, version 3](LICENSE), the same licence as Zotero. You may use, change and share it under the terms of that licence.
