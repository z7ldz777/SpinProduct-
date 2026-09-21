# SpinProduct

SpinProduct is a browser-based product content tool that turns front and back product photos into a rotating product showcase. It is designed for clothing, merchandise, accessories, and other products that benefit from a simple 360-degree visual preview.

The app provides an instant, local canvas preview and browser-based exports. It also includes an optional AI enhancement that uses Google Gemini Veo to generate a more realistic product spin video from the uploaded images.

## Features

- Upload front and back product images by clicking or dragging and dropping.
- Use only one image when a back image is not available; the available image is used for both sides of the preview.
- Render a 60-frame pseudo-3D rotation directly on an HTML canvas.
- Choose a background color from the built-in palette or use a custom color picker.
- Control rotation speed: slow, medium, or fast.
- Control rotation direction: left or right.
- Play, pause, reset, and switch between light and dark themes.
- Export one full rotation as WebM video or animated GIF.
- Select export sizes for Instagram Post, Instagram Story, or Square formats.
- Optionally generate an AI product video with Google Gemini Veo.
- Preview, play, pause, and download the generated AI video.
- Respect reduced-motion preferences for the interface animations.

## How It Works

1. Product images are selected in the browser and loaded as data URLs.
2. SpinShot pre-renders 60 canvas frames using image slicing, horizontal scaling, perspective skew, lighting overlays, and a ground shadow to simulate rotation.
3. The preview animation advances through those frames according to the selected speed and direction.
4. WebM export uses the browser `MediaRecorder` and `canvas.captureStream()` APIs.
5. GIF export uses the app's built-in palette quantization and LZW encoding functions.
6. The optional AI workflow sends the uploaded image data and a product-video prompt to Google Gemini Veo, then polls long-running operations when required.

## AI Video Feature

The AI Video Enhancement panel uses the Google Gemini API and the `veo-3.1-generate-preview` model to request a realistic product showcase video. The generated prompt asks Veo to rotate the product 360 degrees against the selected background color with studio lighting.

### AI Requirements

- A Google AI Studio API key.
- Billing enabled on the Google Cloud project associated with the key.
- A browser session with an uploaded front image.
- Network access to the Google Gemini API.

### Using AI Video Generation

1. Open **AI Video Enhancement**.
2. Paste a Google AI Studio API key into the key field.
3. Upload a front image and optionally a back image.
4. Select **Generate AI Video**.
5. Wait while Veo processes the request. Generation can take approximately 30-120 seconds.
6. Preview or download the returned video.

The API key is held in React state and is not saved to local storage or a database by this app. During local development, Vite proxies `/api/gemini/*` requests to `https://generativelanguage.googleapis.com`. Do not use a personal production API key in a publicly deployed frontend without adding a secure server-side proxy, authentication, rate limiting, and secret management. Browser-based API calls can expose credentials and may be subject to CORS, quota, and billing risks.

## Tech Stack

### Languages and markup

- JavaScript (ES modules)
- JSX
- HTML
- CSS

### Frameworks and tools

- [React](https://react.dev/) 19 for the user interface and state management
- [Vite](https://vite.dev/) 8 for development, bundling, and previewing
- [Tailwind CSS](https://tailwindcss.com/) 4 through `@tailwindcss/vite`
- [ESLint](https://eslint.org/) 9 with React Hooks and React Refresh plugins
- HTML Canvas API for frame rendering and GIF preparation
- MediaRecorder API for WebM export
- Google Gemini Veo API for optional AI video generation

There are currently no runtime dependencies for a backend, database, authentication service, or external media-processing library. Image processing and standard exports happen in the browser.

## Project Structure

```text
spinProduct/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   ├── App.jsx          # Main UI, canvas renderer, exports, and AI workflow
│   ├── index.css        # Global styles and Tailwind import
│   └── main.jsx         # React application entry point
├── eslint.config.js     # ESLint configuration
├── index.html           # Vite HTML entry point and page metadata
├── package.json         # Scripts and dependencies
└── vite.config.js       # Vite, React, Tailwind, and Gemini proxy configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or newer recommended.
- npm, or another package manager compatible with `package.json`.

### Install

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### Create a production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Run linting

```bash
npm run lint
```

## Available npm Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server with hot reload. |
| `npm run build` | Creates an optimized production build in `dist/`. |
| `npm run preview` | Serves the production build locally for inspection. |
| `npm run lint` | Runs ESLint across the project. |

## Browser Considerations

SpinShot relies on modern browser APIs, including HTML Canvas, `MediaRecorder`, `canvas.captureStream()`, `FileReader`, and `URL.createObjectURL()`. Current Chrome, Edge, and other modern Chromium-based browsers provide the most complete support. WebM encoding support varies by browser.

Large source images and high export resolutions can use significant memory because frames are pre-rendered in the browser. Export time and GIF file size depend on the selected resolution and the user's device.

## Privacy and Data Handling

- Uploaded images are processed in browser memory for the local canvas preview and local exports.
- Images are converted to data URLs in React state while the page is open.
- The app does not include a database or persistent user account system.
- Images are sent to Google only when the user starts AI video generation.
- The API key is entered by the user and kept in memory for the current page session; it is not persisted by the app.
- Users should review Google Gemini API terms, quota limits, billing, and data-handling policies before using the AI feature with sensitive product images.

## Current Limitations

- AI generation requires a valid Google API key and may require paid Google Cloud billing.
- The AI integration is intended for local development and trusted environments; it is not a secure production credential architecture.
- The local rotation is a visual simulation rather than true 3D geometry.
- GIF export is palette-quantized and may have lower color fidelity than the canvas preview.
- There is no automated test suite or server-side export pipeline at this time.

## License

No license has been specified for this repository yet. Add a license file before distributing or reusing the project publicly.
