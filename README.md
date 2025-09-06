# VNL Volley Stars

Arcade, canvas-based volleyball with **real players** (Wikimedia photos), **card packs**, **coins**, **achievements**, and a playable **2D match engine**.

## How to use

1. Open `tools/build-players.html` in your browser.
2. Click **Fetch & Download**. It scrapes:
   - VNL squads **2018–2025** (men & women)
   - **All European national teams** (men & women)
   - **Pacific national teams** (last 7 years)
   - **Pacific Games 2019** & **2023**
3. When it finishes it will **alert the total players found** and download `players.json`.
4. Move `players.json` into the project root (next to `index.html`).

Then open `index.html` or deploy to GitHub Pages.

## Controls
- **Arrow keys** move
- **Space/↑** jump
- **Z** attack/serve
- **X** pass/set
- **C** block/dig

## Packs
- Starter / Pro / Legend; duplicates convert to coins.

## Save
- LocalStorage, with Import/Export in **Settings**.
