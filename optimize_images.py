#!/usr/bin/env python3
"""
optimize_images.py — make the portfolio hostable / fast on slow connections.

Extracts every base64-embedded image out of the HTML files and re-encodes each
as a set of RESPONSIVE WebP files (widths 480 / 960 / up to 1920 px), then
rewrites the <img> tag with `srcset` + `sizes` so the browser downloads the
smallest file that fits the screen — tiny on phones / slow links, high-res +
high-quality (~400KB, targeted) on desktop/retina. Images stay plain <img> (no
<picture>), so CSS and the admin editor are untouched.

Idempotent: any <img> whose src is NOT a data: URI is left alone, so re-running
only reprocesses images that are still embedded (e.g. one re-embedded by the
admin editor since the last run). When it does reprocess, it strips any stale
srcset/sizes first.

Run from the portfolio root:  python optimize_images.py
"""

import base64
import io
import os
import re

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
WIDTHS = [480, 960, 1920]     # responsive ladder (downscale only, never upscale)
MAX_W = 1920                  # sharp top ceiling (covers retina/2x desktop)
WEBP_QUALITY = 85             # mobile / mid tiers — kept lean for slow connections
# Top ("sharp desktop") tier: encode at the HIGHEST quality that stays near the
# target; only step down to keep big images ~in range. Files may exceed the
# target when the source is rich (high resolution + detail preserved).
TOP_QUALITY_TRY  = (94, 90, 86, 82)
TOP_TARGET_BYTES = 420 * 1024

IMG_TAG_RE  = re.compile(rb'<img\b[^>]*>', re.IGNORECASE)
SRC_RE      = re.compile(rb'\s*src="[^"]*"', re.IGNORECASE)
SRCSET_RE   = re.compile(rb'\s*srcset="[^"]*"', re.IGNORECASE)
SIZES_RE    = re.compile(rb'\s*sizes="[^"]*"', re.IGNORECASE)
DATA_URI_RE = re.compile(rb'^data:image/[a-zA-Z0-9.+-]+;base64,(.*)$', re.DOTALL)
LOADING_RE  = re.compile(rb'\bloading=', re.IGNORECASE)
GETSRC_RE   = re.compile(rb'src="([^"]*)"', re.IGNORECASE)

UNWRAP_RE   = re.compile(rb'<span class="lqip"[^>]*>\s*(<img\b[^>]*>)\s*</span>')

SIZES_CARD  = b'(max-width:640px) 92vw, (max-width:1024px) 46vw, 380px'
SIZES_PHOTO = b'(max-width:768px) 90vw, 600px'
SIZES_HERO  = b'(max-width:768px) 92vw, 460px'
SIZES_EXP   = b'(max-width:860px) 90vw, 400px'
SIZES_COVER = b'(max-width:768px) 100vw, 860px'
SIZES_GRID  = b'(max-width:640px) 92vw, (max-width:900px) 46vw, 300px'


SOURCE_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def find_source(basename):
    """basename with no extension -> first matching file on disk (any common
    image extension), so replacing e.g. hero_renhart.png with a .jpeg still
    gets picked up. Returns None if no file exists."""
    for ext in SOURCE_EXTS:
        p = os.path.join(ROOT, basename + ext)
        if os.path.exists(p):
            return p
    return None


def target_widths(src_w):
    """Widths to emit: ladder entries below source, plus source capped at MAX_W."""
    ws = [w for w in WIDTHS if w < src_w]
    ws.append(min(src_w, MAX_W))
    return sorted(set(ws))


def save_capped(resized, path, is_top_tier):
    """Mid/small tiers: fixed lean quality (q85). Top tier: pick the highest
    quality (from TOP_QUALITY_TRY) whose file lands within TOP_TARGET_BYTES so
    big images sit ~around the target at maximum quality; if even the lowest try
    is over, keep it (rich sources are allowed to exceed the target)."""
    if not is_top_tier:
        resized.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
        return
    for q in TOP_QUALITY_TRY:
        resized.save(path, "WEBP", quality=q, method=6)
        if os.path.getsize(path) <= TOP_TARGET_BYTES:
            return
    # even q82 is over target -> keep it: preserve high-res detail (>target OK)


def encode_set(im, out_dir, base_name):
    """Write one WebP per target width. Returns (srcset_bytes, default_src_bytes, bytes_written)."""
    if im.mode in ("P", "LA"):
        im = im.convert("RGBA")
    elif im.mode == "CMYK":
        im = im.convert("RGB")
    src_w = im.size[0]
    os.makedirs(out_dir, exist_ok=True)
    widths = target_widths(src_w)
    top_w = widths[-1]
    entries, written, default_src = [], 0, None
    for w in widths:
        if w < src_w:
            h = round(im.size[1] * w / src_w)
            resized = im.resize((w, h), Image.LANCZOS)
        else:
            resized = im
        fname = f"{base_name}-{w}.webp"
        path = os.path.join(out_dir, fname)
        save_capped(resized, path, is_top_tier=(w == top_w))
        written += os.path.getsize(path)
        rel = f"images/{fname}".encode()
        entries.append(rel + b" " + str(w).encode() + b"w")
        if default_src is None or w <= 960:
            default_src = rel          # fallback src = largest width <= 960
    return b", ".join(entries), default_src, written


def rewrite_tag(tag, new_src, srcset, sizes, force_lazy):
    """Return the <img> tag with src/srcset/sizes replaced, other attrs preserved."""
    tag = SRCSET_RE.sub(b'', tag)                 # drop any stale srcset
    tag = SIZES_RE.sub(b'', tag)                  # drop any stale sizes
    tag = SRC_RE.sub(b'', tag, count=1)           # drop old src
    inject = (b' src="' + new_src + b'"'
              + b' srcset="' + srcset + b'"'
              + b' sizes="' + sizes + b'"')
    if force_lazy and not LOADING_RE.search(tag):
        inject += b' loading="lazy"'
    return tag[:4] + inject + tag[4:]             # after '<img'


def process_html(rel_path, out_dir, name_stem, is_works):
    abs_path = os.path.join(ROOT, rel_path)
    data = open(abs_path, "rb").read()
    orig_len = len(data)
    ctr = {"i": 0, "n": 0, "bytes": 0}

    def repl(m):
        tag = m.group(0)
        ctr["i"] += 1
        idx = ctr["i"]
        sm = GETSRC_RE.search(tag)
        if not sm:
            return tag
        dm = DATA_URI_RE.match(sm.group(1))
        if not dm:
            return tag                            # external -> skip (idempotent)
        im = Image.open(io.BytesIO(base64.b64decode(dm.group(1))))
        base_name = f"{name_stem}-{idx:02d}"
        srcset, default_src, wrote = encode_set(im, os.path.join(ROOT, out_dir), base_name)
        ctr["bytes"] += wrote
        ctr["n"] += 1
        sizes = SIZES_COVER if (is_works and idx == 1) else (SIZES_GRID if is_works else SIZES_CARD)
        return rewrite_tag(tag, default_src, srcset, sizes, force_lazy=(is_works and idx >= 2))

    data = IMG_TAG_RE.sub(repl, data)
    if ctr["n"]:
        open(abs_path, "wb").write(data)
        print(f"  {rel_path}: {ctr['n']} imgs -> responsive, "
              f"{orig_len/1024/1024:.2f}MB -> {len(data)/1024:.1f}KB HTML (+{ctr['bytes']/1024:.0f}KB webp)")
    else:
        print(f"  {rel_path}: nothing embedded (already optimized)")
    return ctr["n"]


def process_external_photo():
    """Regenerate photo-renhart.png as responsive WebP and rewrite its <img> refs in
    index.html — EXCEPT the experience-sidebar photo, which has its own distinct
    source (see process_experience_photo)."""
    png = os.path.join(ROOT, "photo-renhart.png")
    if not os.path.exists(png):
        return
    im = Image.open(png)
    srcset, default_src, wrote = encode_set(im, os.path.join(ROOT, "images"), "photo-renhart")
    idx = os.path.join(ROOT, "index.html")
    data = open(idx, "rb").read()

    def repl(m):
        tag = m.group(0)
        if b"photo-renhart" not in tag or b'class="exp-sidebar-photo"' in tag:
            return tag
        # force_lazy only adds loading="lazy" when none exists (harmless here; the
        # remaining photo-renhart ref, about-photo, already carries loading="lazy")
        return rewrite_tag(tag, default_src, srcset, SIZES_PHOTO, force_lazy=True)

    n = len(re.findall(rb'<img\b(?![^>]*class="exp-sidebar-photo")[^>]*photo-renhart[^>]*>', data))
    data = IMG_TAG_RE.sub(repl, data)
    open(idx, "wb").write(data)
    print(f"  photo-renhart.png -> responsive webp ({wrote/1024:.0f}KB), {n} refs rewritten")


def process_experience_photo():
    """Use experience_renhart.* for the Experience-section sidebar photo only
    (class="exp-sidebar-photo"). Its width now matches the sidebar's text column
    (no fixed cap), and — same pattern as the hero — an inline aspect-ratio
    derived from THIS image's real dimensions overrides the CSS fallback, so a
    future swap self-corrects instead of cropping to the old photo's ratio."""
    photo = find_source("experience_renhart")
    if not photo:
        return
    im = Image.open(photo)
    src_w, src_h = im.size
    srcset, default_src, wrote = encode_set(im, os.path.join(ROOT, "images"), "experience-renhart")
    idx = os.path.join(ROOT, "index.html")
    data = open(idx, "rb").read()

    def repl(m):
        tag = m.group(0)
        if b'class="exp-sidebar-photo"' not in tag:
            return tag
        tag = rewrite_tag(tag, default_src, srcset, SIZES_EXP, force_lazy=True)
        tag = WIDTH_ATTR_RE.sub(b'', tag, count=1)
        tag = HEIGHT_ATTR_RE.sub(b'', tag, count=1)
        tag = STYLE_ATTR_RE.sub(b'', tag, count=1)
        extra = f' width="{src_w}" height="{src_h}" style="aspect-ratio:{src_w}/{src_h}"'.encode()
        return tag[:4] + extra + tag[4:]

    data = IMG_TAG_RE.sub(repl, data)
    open(idx, "wb").write(data)
    print(f"  {os.path.basename(photo)} -> exp-sidebar photo ({wrote/1024:.0f}KB responsive)")


WIDTH_ATTR_RE  = re.compile(rb'\s*width="[^"]*"')
HEIGHT_ATTR_RE = re.compile(rb'\s*height="[^"]*"')
STYLE_ATTR_RE  = re.compile(rb'\s*style="[^"]*"')


def process_hero_photo():
    """Use hero_renhart.png for the FIRST-section hero image only (the single
    loading="eager" img in index.html). About + experience keep photo-renhart.
    Run after process_external_photo so it overrides just the hero tag.

    The hero box's height is derived from THIS image's real aspect ratio (an
    inline style, so it always wins over the stylesheet's fallback ratio) —
    otherwise swapping the source photo leaves the box cropped to the old
    photo's proportions. Stale width/height attributes are refreshed too."""
    png = find_source("hero_renhart")
    if not png:
        return
    im = Image.open(png)
    src_w, src_h = im.size
    srcset, default_src, wrote = encode_set(im, os.path.join(ROOT, "images"), "hero-renhart")
    idx = os.path.join(ROOT, "index.html")
    data = open(idx, "rb").read()

    def repl(m):
        tag = m.group(0)
        if b'loading="eager"' not in tag:     # only the hero image is eager
            return tag
        tag = rewrite_tag(tag, default_src, srcset, SIZES_HERO, force_lazy=False)
        tag = WIDTH_ATTR_RE.sub(b'', tag, count=1)
        tag = HEIGHT_ATTR_RE.sub(b'', tag, count=1)
        tag = STYLE_ATTR_RE.sub(b'', tag, count=1)
        extra = (f' width="{src_w}" height="{src_h}" style="aspect-ratio:{src_w}/{src_h}"').encode()
        return tag[:4] + extra + tag[4:]

    data = IMG_TAG_RE.sub(repl, data)
    open(idx, "wb").write(data)
    print(f"  {os.path.basename(png)} -> hero image ({wrote/1024:.0f}KB responsive)")


def make_lqip(im):
    """Tiny (24px) blurred WebP preview as a base64 data URI (~0.5-0.9KB)."""
    im = im.convert("RGB")
    w, h = im.size
    tw = 24
    th = max(1, round(h * tw / w))
    im = im.resize((tw, th), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=45, method=6)
    return b"data:image/webp;base64," + base64.b64encode(buf.getvalue())


def add_blur_up(rel_path):
    """Wrap each local <img> in a <span class="lqip"> whose background is a tiny
    blurred preview, so a blurred image shows instantly and the sharp one fades
    in over it. Runs AFTER responsive processing, on the final external <img>
    tags. Idempotent: existing lqip spans are unwrapped first, then rebuilt."""
    abs_path = os.path.join(ROOT, rel_path)
    html_dir = os.path.dirname(abs_path)
    data = UNWRAP_RE.sub(rb"\1", open(abs_path, "rb").read())   # reset to bare imgs
    n = [0]

    def repl(m):
        tag = m.group(0)
        sm = GETSRC_RE.search(tag)
        if not sm:
            return tag
        src = sm.group(1)
        if src.startswith(b"data:") or src.startswith(b"http"):
            return tag                                          # remote/unresolved -> leave bare
        path = os.path.join(html_dir, src.decode())
        if not os.path.exists(path):
            return tag
        try:
            blur = make_lqip(Image.open(path))
        except Exception:
            return tag
        n[0] += 1
        return b'<span class="lqip" style="background-image:url(' + blur + b')">' + tag + b"</span>"

    data = IMG_TAG_RE.sub(repl, data)
    open(abs_path, "wb").write(data)
    print(f"  {rel_path}: blur-up wrapped {n[0]} imgs")


def main():
    print("Optimizing index.html ...")
    process_html("index.html", "images", "index", is_works=False)
    process_external_photo()
    process_experience_photo()
    process_hero_photo()
    print("Optimizing works/*.html ...")
    works_dir = os.path.join(ROOT, "works")
    works = [fn for fn in sorted(os.listdir(works_dir)) if fn.endswith(".html")]
    for fn in works:
        process_html(os.path.join("works", fn), "works/images", fn[:-5], is_works=True)
    print("Adding blur-up placeholders ...")
    for rel in ["index.html"] + [os.path.join("works", fn) for fn in works]:
        add_blur_up(rel)
    print("Done.")


if __name__ == "__main__":
    main()
