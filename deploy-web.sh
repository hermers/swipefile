#!/bin/sh
# Builds the gallery and publishes it to the gh-pages branch (GitHub Pages serves that branch).
set -e
cd "$(dirname "$0")"
npm --prefix web run build
OUT=$(mktemp -d)
cp -R web/dist/. "$OUT"
touch "$OUT/.nojekyll"
REMOTE=$(git remote get-url origin)
cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy gallery"
git push -q -f "$REMOTE" gh-pages
echo "Published: https://hermers.github.io/swipefile/"
