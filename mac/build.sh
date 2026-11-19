#!/bin/sh
# Builds Hugo.app from Hugo.swift and installs it in /Applications. Run from anywhere: mac/build.sh
set -e
cd "$(dirname "$0")"
OUT="${TMPDIR:-/tmp}/hugo-mac-build"
APP="$OUT/Hugo.app"
rm -rf "$OUT" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$OUT/AppIcon.iconset"
swiftc -swift-version 5 -O -o "$APP/Contents/MacOS/Hugo" Hugo.swift -framework Cocoa -framework WebKit
cp Info.plist "$APP/Contents/Info.plist"
# The icon: the app's own sun, with the margin macOS icons have.
(cd .. && node -e '
import("./scripts/logo.mjs").then(async ({ logoSvg }) => {
  const sharp = (await import("sharp")).default;
  const art = await sharp(Buffer.from(logoSvg({ size: 1024 }))).resize(824, 824).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: art, left: 100, top: 100 }]).png().toFile(process.argv[1]);
});' "$OUT/icon-1024.png")
for s in 16 32 128 256 512; do
  sips -z $s $s "$OUT/icon-1024.png" --out "$OUT/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); sips -z $d $d "$OUT/icon-1024.png" --out "$OUT/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$OUT/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$APP" >/dev/null 2>&1
rm -rf /Applications/Hugo.app && cp -R "$APP" /Applications/Hugo.app
echo "installed /Applications/Hugo.app"
