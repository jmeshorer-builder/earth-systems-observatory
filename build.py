#!/usr/bin/env python3
"""
ESO Build Script — combines modular source files into single-file HTML.

Usage:
  python3 build.py          → readable build  (earth-observatory-p3.html)
  python3 build.py --min    → minified build  (earth-observatory-p3.min.html)
  python3 build.py --both   → both outputs

Minification removes // single-line comments, /* */ block comments, and
collapses excess blank lines. Source files are never modified.
"""
import os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__)) or "."

def read(fn):
    with open(os.path.join(BASE, fn), encoding="utf-8") as f:
        return f.read()

def minify_js(src):
    """Strip // comments (not inside strings), block comments, and blank lines."""
    # Remove /* ... */ block comments first
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    # Remove // line comments — but NOT URLs (http://) and NOT commented-out code we want to skip
    # Safe approach: only strip lines where // is the first non-whitespace content
    lines = src.split('\n')
    out = []
    prev_blank = False
    for line in lines:
        stripped = line.lstrip()
        # Drop pure comment lines
        if stripped.startswith('//'):
            continue
        # Drop blank lines but collapse runs to single blank
        if stripped == '':
            if not prev_blank:
                out.append('')
            prev_blank = True
        else:
            out.append(line)
            prev_blank = False
    return '\n'.join(out)

def minify_css(src):
    """Strip /* */ comments and blank lines from CSS."""
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    lines = [l for l in src.split('\n') if l.strip()]
    return '\n'.join(lines)

def build(minify=False, suffix=''):
    css    = read("eso-style.css")
    stats  = read("eso-stats.js")
    core   = read("eso-core.js")
    data   = read("eso-data.js")
    ui     = read("eso-ui.js")
    thesis = read("eso-thesis.js")
    ta     = read("thesis-a-solar-seismic.js")
    tb     = read("thesis-b-tidal-seismic.js")
    html   = read("earth-observatory-modular.html")

    if minify:
        css    = minify_css(css)
        stats  = minify_js(stats)
        core   = minify_js(core)
        data   = minify_js(data)
        ui     = minify_js(ui)
        thesis = minify_js(thesis)
        ta     = minify_js(ta)
        tb     = minify_js(tb)

    html = html.replace('<link rel="stylesheet" href="eso-style.css">',
                        f"<style>\n{css}\n</style>")
    for tag, src in [
        ('<script src="eso-stats.js"></script>',              stats),
        ('<script src="eso-core.js"></script>',               core),
        ('<script src="eso-data.js"></script>',               data),
        ('<script src="eso-ui.js"></script>',                 ui),
        ('<script src="eso-thesis.js"></script>',             thesis),
        ('<script src="thesis-a-solar-seismic.js"></script>', ta),
        ('<script src="thesis-b-tidal-seismic.js"></script>', tb),
    ]:
        html = html.replace(tag, f"<script>\n{src}\n</script>")

    out = os.path.join(BASE, f"earth-observatory-p3{suffix}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    kb = os.path.getsize(out) // 1024
    lines = html.count('\n') + 1
    label = "minified" if minify else "readable"
    print(f"Built [{label}] {os.path.basename(out)}  —  {lines:,} lines  /  {kb} KB")

args = sys.argv[1:]
do_min  = '--min'  in args or '--both' in args
do_full = '--min' not in args or '--both' in args

if do_full:
    build(minify=False, suffix='')
if do_min:
    build(minify=True, suffix='.min')
