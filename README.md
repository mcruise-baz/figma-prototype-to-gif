# Figma prototype → 24fps GIF (local app)

Convert public Figma prototype/share links into **24fps GIFs that loop endlessly**, using a local web UI and a Node/Playwright backend.

The app:

- Loads each Figma prototype in headless Chromium
- Waits for network idle + a short settle delay
- Captures frames at **24fps** for a fixed duration
- Encodes them into high‑quality, infinitely looping GIFs via FFmpeg

## Requirements

- Node.js 18+ (recommended)
- macOS (Chromium via Playwright is installed automatically)

## Install

Clone the repo and install dependencies:

```bash
cd ~/figma-prototype-to-gif
npm install
cd web
npm install
cd ..
```

## Run the app locally

From the project root:

```bash
cd ~/figma-prototype-to-gif
npm run dev
```

This starts:

- The **backend server** on `http://localhost:8787`
- The **Vite React UI** on something like `http://localhost:5173` (it will open in your browser)

The frontend proxies `/api/*` calls to the backend, so you don’t have to think about ports.

## Using the UI

1. Open the UI (Vite will log the exact URL, typically `http://localhost:5173`).
2. In **“Prototype links”**, paste one or more **public** Figma prototype URLs, one per line.
3. Set:
   - **Duration (seconds)** – how long to record each prototype
   - **Viewport preset**:
     - `iPhone 13 (390×844)`
     - `Desktop 1440×900`
     - or `Custom` width/height
   - **Quality (scale)** – 25–100% output size
   - **Dithering** – `Bayer` (smoother gradients, larger) or `None` (sharper, smaller)
4. Click **“Render GIFs”**.
5. Watch **“Progress & downloads”**:
   - Phases: `launching` → `navigating` → `capturing` → `encoding` → `finalizing`
   - You’ll see frame counts during capture.
6. Once the job status is **`succeeded`**, download each GIF using the provided **Download GIF** links.

Output GIFs are also stored on disk under:

```text
./output/<jobId>/*.gif
```

## Notes & limitations

- Links must be **publicly accessible**; the app does not log into Figma.
- Prototypes should advance via **“after delay”** or self‑running animations; the tool does not click through flows.
- Duration is fixed per job (e.g. 10 seconds at 24fps → 240 frames per prototype).

## Troubleshooting

- **Playwright / Chromium download issues**
  - Run:
    ```bash
    cd ~/figma-prototype-to-gif
    npx playwright install chromium
    ```

- **FFmpeg issues**
  - The app uses `ffmpeg-static`. If you have a system `ffmpeg` installed, it will fall back to that if needed.

- **Nothing happens when you click Render**
  - Check the terminal where `npm run dev` is running for errors.
  - Ensure links start with `https://` and are valid URLs.

## Scripts

From the project root:

- `npm run dev` – start server + Vite dev UI
- `npm run dev:server` – start only the server (API)
- `npm run dev:web` – start only the Vite dev server (UI)

