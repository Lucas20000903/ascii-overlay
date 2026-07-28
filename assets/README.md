# Banner assets

`banner.webp` and `video.webp` are rendered by the library, so they can be rebuilt.

```bash
npm run build      # the scripts import dist/
npm run serve      # serves the project root with no-store
```

Open `http://127.0.0.1:8901/demo/`, then in the console:

```js
const s = document.createElement('script');
s.src = '/assets/banner.js';      // or /assets/video.js
document.head.append(s);
const api = await window.__bannerReady;   // or __videoReady
api.frame(0).toDataURL('image/png');      // banner: 0..7, video: 0..23
```

Save the frames as png and pack them:

```bash
img2webp -loop 0 -lossy -q 90 -m 6 -d 125 f0.png ... f7.png -o assets/banner.webp
img2webp -loop 0 -lossy -q 76 -m 6 -d 83  f00.png ... f23.png -o assets/video.webp
```

`-d 125` is 8fps, which is the rate squigglevision needs. Every frame would read as noise.

`video.js` expects frames extracted from `src/sunflower.mp4`:

```bash
mkdir -p assets/src/video
ffmpeg -i assets/src/sunflower.mp4 -vf "fps=12,scale=720:405:flags=lanczos" /tmp/f%03d.png
for f in /tmp/f*.png; do cwebp -q 88 "$f" -o "assets/src/video/$(basename ${f%.png}).webp"; done
```

The sun is worth a note. Its silhouette is used as a `mask` predicate, but the brightness the
glyphs read is painted from that silhouette rather than taken from the asset. The asset's ink
covers about a seventh of the frame, since the disc is hollow and the rays leave wide gaps, so
feeding those pixels in as the source leaves most of the shape reading as background.
