# VNL Volley Stars

Arcade volleyball + card-collecting game — static build for GitHub Pages.

## What’s inside

- **index.html** — Game shell
- **styles.css** — UI
- **integration.js** — Canvas engine, AI, packs, collection, **Libero system**
- **players.json** — 1000 pre-made fake players, **200 Liberos**
- **packs.json** — Pack prices + rarity distribution
- **error-logger.js** — Global error logging to localStorage with download
- **debug.html / debug.js** — Dataset validator, image checker, log tools

## Run locally
Just open `index.html` in a modern browser (or serve via any static host).

## Debug Tools
Open `debug.html` to:
- Validate dataset (count, positions, rarities).
- HEAD-check image URLs.
- Download or clear error logs.

## Notes
This bundle uses placeholder images from Wikimedia which are hotlink-friendly.
