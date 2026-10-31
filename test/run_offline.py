"""Checks that don't need Zotero. Run from anywhere:

    pip install -r test/requirements.txt
    python test/run_offline.py

It checks that every script parses, that the dialogs' XHTML is well formed,
that the locale file parses, that every localization ID and element ID the
code uses exists, and then runs extra-fields.tests.js with the modules that
don't need Zotero. Exits with 1 if anything fails.
"""

import re
import sys
import xml.dom.minidom
from pathlib import Path

import quickjs
from fluent.syntax import ast, parse

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
FTL = ROOT / "locale" / "en-US" / "extra-columns.ftl"
# Loaded in this order, as bootstrap.js does. The rest need Zotero.
PURE_SCRIPTS = ["extra-fields.js", "export-formats.js", "export-template.js", "export-table.js"]
# Each dialog's script, and the markup its byID() calls refer to.
DIALOGS = {"export.js": "export.xhtml", "preferences.js": "preferences.xhtml"}

failures = []


def fail(message):
    failures.append(message)
    print(f"FAIL  {message}")


def read(path):
    return path.read_text(encoding="utf-8")


def js_files():
    return [ROOT / "bootstrap.js", *sorted(CONTENT.glob("*.js"))]


def check_syntax(ctx):
    ctx.eval("var checkSyntax = (src) => { try { new Function(src); return ''; } catch (e) { return String(e); } };")
    sources = {path: read(path) for path in js_files()}
    # The test script is the body of an async function.
    test = ROOT / "test" / "extra-fields.tests.js"
    sources[test] = f"return (async function () {{\n{read(test)}\n}});"
    for path, source in sources.items():
        error = ctx.get("checkSyntax")(source)
        if error:
            fail(f"{path.relative_to(ROOT)} doesn't parse: {error}")


def element_ids():
    """Element ids in each XHTML file, which must also be well formed."""
    ids = {}
    for path in sorted(CONTENT.glob("*.xhtml")):
        source = read(path)
        # A settings pane is a fragment, which Zotero puts inside an element
        # that declares the XUL and html: namespaces.
        if not source.lstrip().startswith("<?xml"):
            source = ('<fragment xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"'
                      ' xmlns:html="http://www.w3.org/1999/xhtml">' + source + "</fragment>")
        try:
            xml.dom.minidom.parseString(source)
        except Exception as e:
            fail(f"{path.name} isn't well formed: {e}")
        ids[path.name] = set(re.findall(r'\bid="([^"]+)"', read(path)))
    return ids


def ftl_messages():
    resource = parse(read(FTL))
    for entry in resource.body:
        if isinstance(entry, ast.Junk):
            notes = "; ".join(annotation.message for annotation in entry.annotations)
            fail(f"locale file has a syntax error ({notes}) in: {entry.content.strip()[:80]}")
    names = [entry.id.name for entry in resource.body if isinstance(entry, ast.Message)]
    for name in sorted({name for name in names if names.count(name) > 1}):
        fail(f"locale file defines {name} more than once")
    return set(names)


# Strings that start with extra-columns- but aren't localization or element
# ids: class names, the start of an id built in code, and the menu's id.
NOT_AN_ID = re.compile(r'(className:\s*|classList\.\w+\(\s*|menuID:\s*)"[^"]*"|"[^"]*"\s*\+')


def check_ids(messages, ids_by_file):
    all_element_ids = set().union(*ids_by_file.values())

    for xhtml, ids in ids_by_file.items():
        for l10n_id in re.findall(r'data-l10n-id="([^"]+)"', read(CONTENT / xhtml)):
            if l10n_id not in messages:
                fail(f"{xhtml} uses {l10n_id}, which isn't in the locale file")

    for path in js_files():
        source = read(path)
        names = set(re.findall(r'"(extra-columns-[\w-]+)"', NOT_AN_ID.sub("", source)))
        for name in sorted(names - messages - all_element_ids):
            fail(f"{path.name} uses {name}, which is neither a locale message nor an element id")

    for script, xhtml in DIALOGS.items():
        source = read(CONTENT / script)
        for element_id in sorted(set(re.findall(r'byID\("([^"]+)"\)', source)) - ids_by_file[xhtml]):
            fail(f"{script} looks up #{element_id}, which isn't in {xhtml}")

    # Template problems are shown with "extra-columns-export-template-" + code.
    codes = set(re.findall(r'fail\("([\w-]+)"\)', read(CONTENT / "export-template.js")))
    codes |= set(re.findall(r'code:\s*"([\w-]+)"', read(CONTENT / "export-table.js")))
    for code in sorted(codes):
        if f"extra-columns-export-template-{code}" not in messages:
            fail(f"template error {code} has no extra-columns-export-template-{code} message")


def run_tests(ctx):
    ctx.eval("var Zotero = { getString: (key) => key, debug: () => {} };")
    for script in PURE_SCRIPTS:
        ctx.eval(read(CONTENT / script))
    ctx.eval("""
        Zotero.ExtraColumns = { offline: true, ExtraFields, ExportFormats, ExportTemplate, ExportTable };
        var testResult = null;
    """)
    ctx.eval(
        "(async function () {\n" + read(ROOT / "test" / "extra-fields.tests.js") + "\n})()"
        ".then((result) => { testResult = result; }, (e) => { testResult = 'ERROR ' + e + '\\n' + e.stack; });"
    )
    while ctx.execute_pending_job():
        pass
    result = ctx.get("testResult")
    print(result)
    if result is None or result.startswith("ERROR") or "FAIL  " in result:
        fail("extra-fields.tests.js has failures")


def main():
    ctx = quickjs.Context()
    check_syntax(ctx)
    check_ids(ftl_messages(), element_ids())
    run_tests(quickjs.Context())
    print()
    print(f"{len(failures)} problem(s)" if failures else "All offline checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
