#!/usr/bin/env bash
# Convert image(s) to .webp — helper for dropping site photos (e.g. mitch.webp,
# lochlann.webp into webserver/sexypickleclub/).
#
# Usage:
#   tools/to-webp.sh [-f] [-q QUALITY] [-w WIDTH] [-o OUTDIR] FILE [FILE...]
#
#   -f          overwrite an existing .webp instead of skipping it
#   -q N        webp quality (default 82)
#   -w WIDTH    resize so width == N px, preserving aspect (e.g. -w 800)
#   -o OUTDIR   write .webp files here instead of next to the source
#
# Examples:
#   tools/to-webp.sh mitch.jpg                      # -> mitch.webp beside it
#   tools/to-webp.sh -w 800 -o webserver/sexypickleclub ~/pics/lochlann.png
set -euo pipefail

force=0 quality=82 width="" outdir=""
while getopts "fq:w:o:" opt; do
  case "$opt" in
    f) force=1 ;;
    q) quality="$OPTARG" ;;
    w) width="$OPTARG" ;;
    o) outdir="$OPTARG" ;;
    *) echo "Usage: tools/to-webp.sh [-f] [-q N] [-w WIDTH] [-o OUTDIR] FILE..." >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

[ $# -ge 1 ] || { echo "Usage: tools/to-webp.sh [-f] [-q N] [-w WIDTH] [-o OUTDIR] FILE..." >&2; exit 2; }
command -v magick >/dev/null 2>&1 || { echo "magick (ImageMagick) not found" >&2; exit 1; }

[ -n "$outdir" ] && mkdir -p "$outdir"

rc=0
for f in "$@"; do
  case "$f" in
    *.webp|*.WEBP) echo "skip (already webp): $f"; continue ;;
  esac
  if [ ! -f "$f" ]; then echo "not found: $f" >&2; rc=1; continue; fi

  base="$(basename "${f%.*}")"
  out="${outdir:-$(dirname "$f")}/$base.webp"
  if [ -e "$out" ] && [ "$force" -ne 1 ]; then
    echo "skip (exists, use -f): $out"
    continue
  fi

  resize=()
  [ -n "$width" ] && resize=(-resize "${width}x")

  if magick "$f" "${resize[@]}" -quality "$quality" "$out"; then
    orig=$(stat -c%s "$f"); new=$(stat -c%s "$out")
    printf '%s -> %s (%s -> %s)\n' "$f" "$out" "$(numfmt --to=iec "$orig" 2>/dev/null || echo "${orig}B")" "$(numfmt --to=iec "$new" 2>/dev/null || echo "${new}B")"
  else
    echo "FAILED: $f" >&2; rc=1
  fi
done
exit "$rc"