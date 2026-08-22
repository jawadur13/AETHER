# AETHER — Codex of Synthesized Realities

Aether is an immersive, interactive ambient audio-visual experience and synthesizer sandbox built entirely in the browser. Using the HTML5 **Web Audio API** and **Canvas API**, it generates complex ambient frequencies, generative melodies, geometric space clocks, and cryptographic signals procedurally in real-time. No external audio files or pre-rendered images are used—everything is synthesized dynamically on-the-fly.

## 🌌 The Concept

Aether is designed as an interactive cosmic terminal containing three separate dashboards that explore the relationships between frequency, space, time, and language:

1. **Constellation Mixer (Spatial Synthesizer)**: An interactive night sky where glowing celestial bodies represent independent sound elements (nebula drones, granular chimes, solar filter winds, arpeggiated pulsars, sub-basses). Dragging stars close to the center "Core" increases their volume through spatial mix calculations, while dragging them to the boundaries fades them out. Double-clicking any star opens its detailed analog controls (frequency, lowpass filter, resonance, LFO speed, LFO depth, delay times, and feedback).
2. **Chrono-Resonator (Celestial Time Clock)**: A generative geometric space-clock translating the system time of day into a shifting polyphonic chord. Hours map to root notes, minutes dictate the chord structure (e.g. Minor 9th, Major 7th, Suspended), and seconds drive low-pass filter sweeps, creating a mechanical breathing quality.
3. **Morse Messenger (Cryptographic Laser Beacon)**: A digital message transmitter. Write any text to translate it into flashing laser beacon pulses and high-frequency sound wave code running through an feedback echo chamber.

## 🛠️ Technology Stack

- **Framework**: Vite + Vanilla JavaScript (ES Modules) for lightweight, near-instantaneous bundling and hot reloading.
- **Synthesizer Engine**: Web Audio API (procedural White Noise Buffers, LFO Oscillators, Biquad Lowpass Filters, Gain Nodes, and Feedback Delay loops).
- **Graphics Engine**: HTML5 Canvas API (dynamic visualizers, particles, math clocks, and starfields).
- **Styling**: Vanilla CSS featuring a custom futuristic glassmorphism design system, glowing animations, custom range-sliders, and media queries.
- **Fonts**: Space Grotesk (layout & titles) and Share Tech Mono (telemetry & data readouts) loaded from Google Fonts.

## 📂 Project Structure

```
├── public/
│   ├── favicon.svg             # Page icon
│   └── icons.svg               # Vector assets
├── src/
│   ├── audio.js                # Core Web Audio API synth classes and nodes
│   ├── visualizer.js           # Canvas visualizer preset drawing functions
│   ├── constellation.js        # Constellation canvas star positions & mixing controls
│   ├── clock.js                # Chrono Clock canvas geometric orbits
│   ├── morse.js                # Morse translation dictionary & playback timeouts
│   ├── main.js                 # Central orchestrator loading events & telemetry
│   └── style.css               # Styling rules, variables, animations & responsive css
├── index.html                  # Main layout wireframe
├── package.json                # Project configurations & scripts
└── README.md                   # Project documentation
```

## 🔋 Features

- **Spatial Mixer Canvas**: Drag and drop nodes to change mixing. Node orbital drift introduces gentle periodic variations.
- **Full Synthesizer Matrix**: Select oscillator waves (Sine, Triangle, Sawtooth, Square) and fine-tune frequencies, LFO rates, filter resonances, and delay times.
- **Chrono-Resonator Audio**: Four-voice additive synthesizer that changes chords dynamically every minute.
- **Morse Beacon**: Character speed (WPM) and tone pitch controls with live code logs printing into a virtual feedback screen.
- **Resonance Canvas (3 Visualizer Modes)**:
  - *Hyper-Spectrum*: 3D circular audio frequency bars.
  - *Nebula Pulse*: Gravity particle flows moving in sync with sub-bass frequencies.
  - *Aether Waves*: Overlapping, translucent gradient waves driven by real-time time-domain signals.
- **Master Telemetry HUD**: Constant telemetry display on header counters tracking Active Oscillators count, Audio Sample Rate, and Browser Frame Rate (FPS).
- **Sparkline Preview**: Floating analyzer sparkline in the bottom footer that displays waveforms at all times.
- **Atmosphere Presets**: Quick preset selectors loaded in the footer to shift the environment mood ("Cosmic Wind", "Abyssal Vent", "Vintage Core", "Cyberpunk Storm").

## 🚀 How to Run the Project

Follow these steps to run the website locally:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ recommended).

### Installation & Run

1. Open your terminal in the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local URL in your browser (usually `http://localhost:5173/`).
5. Turn up your volume (headphones recommended) and click **"Enter the Resonance"** to start the context!

### Building for Production
To build a production-ready optimized package:
```bash
npm run build
```
This outputs compiled assets into a `dist/` directory, which can be deployed directly to any static web hosting provider (Vercel, Netlify, GitHub Pages, etc.).

## Roadmap

- Add MIDI input mapping for the Constellation Mixer.
- Persist dashboard state to `localStorage`.
- Export generative sessions as audio loops.
