## Item pane

# Used on every custom Info row. It has no value on purpose, so the row keeps
# the column name the user typed and only gains this tooltip.
extra-columns-field-label =
    .title = Custom field stored in the Extra field

extra-columns-invalid-number-title = Not a number
extra-columns-invalid-number = { $label } must be a number, for example 3 or -1.5.

## Settings pane: fields

extra-columns-prefs-fields-title = Custom columns
extra-columns-prefs-intro = Each field adds a column to the item list and an editable row to the Info section. Values are saved as "Key: value" lines in each item's Extra field, so they sync with your library.
extra-columns-prefs-col-label = Column name
extra-columns-prefs-col-key = Extra key
extra-columns-prefs-col-number = Number
extra-columns-prefs-empty = No fields yet. Add one below, or detect fields already in your library.
extra-columns-prefs-data-note = Removing a field or changing its type never changes your items. Their Extra lines stay in place.

extra-columns-prefs-new-label =
    .placeholder = New column name
    .aria-label = New column name
extra-columns-prefs-new-key =
    .placeholder = Extra key (defaults to the name)
    .aria-label = Extra key for the new column
extra-columns-prefs-new-number =
    .aria-label = Store the new column as a number
extra-columns-prefs-add =
    .label = Add field

extra-columns-prefs-label-input =
    .aria-label = Column name for { $key }
extra-columns-prefs-number-input =
    .aria-label = Store { $key } as a number
extra-columns-prefs-move-up =
    .label = Up
    .tooltiptext = Move this column up
extra-columns-prefs-move-down =
    .label = Down
    .tooltiptext = Move this column down
extra-columns-prefs-remove =
    .label = Remove
    .tooltiptext = Remove this column. Item data is kept.

extra-columns-error-key-syntax = The Extra key must start with a letter and use only letters, digits, spaces, periods, hyphens and underscores.
extra-columns-error-key-duplicate = Another field already uses the Extra key "{ $key }".
extra-columns-error-key-reserved = Zotero already reads "{ $key }" from Extra for its own data, so it can't be used as a custom key.
extra-columns-error-skipped = Zotero now uses this key for its own data, so this column is hidden.
extra-columns-prefs-unavailable = The Extra Columns plugin isn't running. Re-enable it in Tools > Plugins, then reopen Settings.

## Settings pane: detection

extra-columns-prefs-detect-title = Detect fields from your library
extra-columns-prefs-detect-intro = Lists "Key: value" lines in Extra that Zotero doesn't use itself. Use this to set up the same columns on another computer.
extra-columns-prefs-detect =
    .label = Detect from library
extra-columns-prefs-detect-running = Scanning Extra fields...
extra-columns-prefs-detect-none = No unused Extra keys found.
extra-columns-prefs-detect-failed = Scanning failed. See Tools > Developer > Error Console for details.
extra-columns-prefs-detect-found =
    { $count ->
        [one] Found 1 key.
       *[other] Found { $count } keys.
    }
extra-columns-prefs-detect-col-add = Add
extra-columns-prefs-detect-col-items = Items
extra-columns-prefs-detect-col-sample = Example value
extra-columns-prefs-detect-select =
    .aria-label = Add { $key } as a column
extra-columns-prefs-detect-add =
    .label = Add selected

## Export as Table

extra-columns-export-menu =
    .label = Export as Table...
extra-columns-export-window =
    .title = Export as Table
extra-columns-export-format-label = Format:
extra-columns-export-format-markdown = Markdown table
extra-columns-export-format-latex = LaTeX table
extra-columns-export-format-csv = CSV (comma-separated values)
extra-columns-export-columns-label = Columns, in export order
extra-columns-export-match =
    .label = Match item list
    .tooltiptext = Use the columns shown in the item list, in the same order
extra-columns-export-col-creators = All Creators
extra-columns-export-col-citation-tag = Citation (@key)
extra-columns-export-col-latex-citation = Citation (\cite{"{"}key{"}"})
extra-columns-export-col-citekey = Citation key, as exported
extra-columns-export-add-combined =
    .label = Add combined column
    .tooltiptext = Add a column that puts several fields in one cell
extra-columns-export-editor-heading = Combined column
extra-columns-export-combined-name = Name:
extra-columns-export-combined-template = Template:
extra-columns-export-combined-default-name = Combined column
extra-columns-export-combined-untitled = (no name)
extra-columns-export-combined-help = Write {"{"}Field{"}"} for a value, using a field's key or name. Text in [ ] is left out when a field in it is empty, and text between two [ ] is only kept when both are shown. For example: @{"{"}citekey{"}"}[ ({"{"}year{"}"})] or [D: {"{"}Disorder{"}"}]; [F: {"{"}Brain Function{"}"}]
extra-columns-export-combined-preview = First item: { $value }
extra-columns-export-combined-preview-empty = Empty for the first item.
extra-columns-export-insert-field =
    .label = Insert field…
extra-columns-export-combined-edit =
    .label = Edit
    .tooltiptext = Edit this combined column
extra-columns-export-combined-remove =
    .label = Remove
    .tooltiptext = Remove this combined column
extra-columns-export-combined-done =
    .label = Done
extra-columns-export-template-unclosed-brace = A {"{"} has no matching {"}"}. To show a brace as text, write \{"{"} or \{"}"}.
extra-columns-export-template-unexpected-brace = A {"}"} has no matching {"{"}. To show a brace as text, write \{"{"} or \{"}"}.
extra-columns-export-template-unclosed-bracket = A [ has no matching ]. To show a bracket as text, write \[ or \].
extra-columns-export-template-unexpected-bracket = A ] has no matching [. To show a bracket as text, write \[ or \].
extra-columns-export-template-empty-name = {"{"}{"}"} needs a field name inside it.
extra-columns-export-template-unknown-field = No field is called “{ $name }”. Use Insert field to pick one.
extra-columns-export-invalid = Fix the template of “{ $name }” to export, or untick it.
extra-columns-export-summary =
    { $count ->
        [one] 1 item will be exported.
       *[other] { $count } items will be exported.
    }
extra-columns-export-skipped =
    { $count ->
        [one] 1 note or attachment is left out.
       *[other] { $count } notes and attachments are left out.
    }
extra-columns-export-copy =
    .label = Copy to clipboard
extra-columns-export-save =
    .label = Save...
extra-columns-export-save-title = Save Table
extra-columns-export-file-name = Zotero items
extra-columns-export-save-failed = The table couldn't be saved. See Tools > Developer > Error Console for details.
