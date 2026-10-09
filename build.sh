#!/usr/bin/env bash
# Builds build/extra-columns.xpi and build/updates.json for the given version.
# manifest.json and updates.json are templates; this fills in their placeholders.
#
#   bash build.sh 0.1.2
#
# Needs zip and sha256sum.

set -euo pipefail

version="${1:?usage: bash build.sh <version>, for example 0.1.2}"
cd "$(dirname "$0")"

rm -rf build
mkdir -p build/stage

# Plugin files, with the version filled into the manifest.
cp -R bootstrap.js prefs.js content locale build/stage/
sed "s/{{VERSION}}/$version/g" manifest.json > build/stage/manifest.json
(cd build/stage && zip -q -r ../extra-columns.xpi .)

# updates.json, which Zotero reads through the manifest's update_url.
id=$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' manifest.json)
min_version=$(sed -n 's/.*"strict_min_version": *"\([^"]*\)".*/\1/p' manifest.json)
hash=$(sha256sum build/extra-columns.xpi | cut -d " " -f 1)
sed -e "s/{{VERSION}}/$version/g" \
	-e "s/{{ID}}/$id/g" \
	-e "s/{{STRICT_MIN_VERSION}}/$min_version/g" \
	-e "s/{{XPI_SHA256}}/$hash/g" \
	updates.json > build/updates.json

rm -rf build/stage
echo "Built build/extra-columns.xpi and build/updates.json (version $version)"
