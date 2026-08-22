import "./style.css";
import { AudioEngine } from "./audio.js";
import { Visualizer } from "./visualizer.js";
import { Constellation } from "./constellation.js";
import { ChronoClock } from "./clock.js";
import { MorseEngine } from "./morse.js";

// --- TELEMETRY CALCULATOR ---
class TelemetryTracker {
  constructor(oscEl, fpsEl) {
    this.oscEl = oscEl;
    this.fpsEl = fpsEl;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.track();
  }

  updateOscCount(count) {
    if (this.oscEl) this.oscEl.textContent = count;
  }

  track() {
    const loop = () => {
      this.frameCount++;
      const now = performance.now();
      const delta = now - this.lastTime;
      
      if (delta >= 500) {
        const fps = Math.round((this.frameCount * 1000) / delta);
        if (this.fpsEl) this.fpsEl.textContent = fps;
        this.frameCount = 0;
        this.lastTime = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// --- AMBIENT STARFIELD BACKDROP ---
class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stars = [];
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.initStars();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.05 + Math.random() * 0.15,
        alpha: 0.1 + Math.random() * 0.7,
        hue: 200 + Math.random() * 60 // Soft blue/violet stars
      });
    }
  }

  animate() {
    // Clear canvas
    this.ctx.fillStyle = "rgba(4, 2, 9, 0.3)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.stars.forEach(star => {
      star.x += star.speed;
      
      // Reset if offscreen
      if (star.x > this.canvas.width) {
        star.x = 0;
        star.y = Math.random() * this.canvas.height;
      }
      
      this.ctx.fillStyle = `hsla(${star.hue}, 60%, 75%, ${star.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    requestAnimationFrame(() => this.animate());
  }
}

// --- APP INITIALIZER ---
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Core Engines
  const audio = new AudioEngine();
  
  // Element selections
  const introOverlay = document.getElementById("intro-overlay");
  const btnEnter = document.getElementById("btn-enter");
  const appHeader = document.querySelector(".app-header");
  const appMain = document.querySelector(".app-main");
  const appFooter = document.querySelector(".app-footer");
  
  // Header Telemetry
  const telemetryOsc = document.getElementById("telemetry-osc");
  const telemetryRate = document.getElementById("telemetry-rate");
  const telemetryFps = document.getElementById("telemetry-fps");
  
  // Backdrops & Canvas references
  const bgCanvas = document.getElementById("bg-starfield");
  const constellationCanvas = document.getElementById("constellation-canvas");
  const resonanceCanvas = document.getElementById("resonance-canvas");
  const sparklineCanvas = document.getElementById("sparkline-canvas");
  const clockCanvas = document.getElementById("clock-vector-canvas");
  
  // Initialize Starfield
  new Starfield(bgCanvas);
  
  // Telemetry Tracker
  const telemetry = new TelemetryTracker(telemetryOsc, telemetryFps);

  // Instantiating secondary modules (delayed till enter)
  let visualizer = null;
  let constellation = null;
  let chronoClock = null;
  let morse = null;

  // --- WELCOME TAP GESTURE (ENTER THE RESONANCE) ---
  btnEnter.addEventListener("click", () => {
    // 1. Boot audio context
    audio.resume();
    
    // Set audio rate indicator
    if (telemetryRate && audio.ctx) {
      telemetryRate.textContent = (audio.ctx.sampleRate / 1000).toFixed(1) + "k";
    }
    
    // 2. Hide intro and show app dashboard
    introOverlay.classList.add("fade-out");
    appHeader.classList.remove("hidden");
    appMain.classList.remove("hidden");
    appFooter.classList.remove("hidden");
    
    // 3. Initialize visual interfaces
    visualizer = new Visualizer(resonanceCanvas, sparklineCanvas, audio);
    visualizer.start();
    
    constellation = new Constellation(constellationCanvas, audio, (node) => {
      openSidebarControl(node);
    });
    
    chronoClock = new ChronoClock(
      clockCanvas, 
      document.getElementById("chrono-time"), 
      document.getElementById("chrono-date"), 
      audio
    );
    
    morse = new MorseEngine(audio);
    
    // Begin updating active oscillator counters periodically
    setInterval(() => {
      telemetry.updateOscCount(audio.activeOscCount);
    }, 500);
  });

  // --- TABS / VIEW NAVIGATION SYSTEM ---
  const navBtns = document.querySelectorAll(".nav-btn");
  const appViews = document.querySelectorAll(".app-view");
  
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      
      // Toggle button states
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Switch active layout section view
      appViews.forEach(view => {
        view.classList.remove("active");
        if (view.id === `view-${target}`) {
          view.classList.add("active");
        }
      });
      
      // Stop/Start resource intensive sub-renders to optimize performance
      if (target === "clock") {
        if (chronoClock) {
          chronoClock.stop();
          chronoClock.start();
        }
        if (audio.isPlaying) audio.startClockDrone();
      } else {
        if (chronoClock) chronoClock.stop();
        audio.stopClockDrone();
      }
      
      // Force trigger canvas resize updates on view activation
      setTimeout(() => {
        if (target === "constellation" && constellation) constellation.resize();
        if (target === "visualizer" && visualizer) visualizer.resize();
        if (target === "clock" && chronoClock) chronoClock.resize();
      }, 50);
    });
  });

  // --- FLOATING CONTROL PANEL HANDLERS ---
  const btnMasterPlay = document.getElementById("btn-master-play");
  const selectPreset = document.getElementById("select-preset");
  const sliderMasterVolume = document.getElementById("slider-master-volume");
  const valMasterVolume = document.getElementById("val-master-volume");

  // Play/Pause Master Switcher
  btnMasterPlay.addEventListener("click", () => {
    if (audio.isPlaying) {
      audio.suspend();
      btnMasterPlay.innerHTML = `<span class="play-icon">▶</span>`;
      btnMasterPlay.classList.remove("playing");
      
      // Also halt clock drone, morse signals
      audio.stopClockDrone();
      if (morse) morse.stop();
    } else {
      audio.resume();
      btnMasterPlay.innerHTML = `<span class="play-icon">❚❚</span>`;
      btnMasterPlay.classList.add("playing");
      
      // Resume clock drone if active tab
      const isClockTab = document.querySelector(".nav-btn[data-target='clock']").classList.contains("active");
      if (isClockTab && audio.isPlaying) {
        audio.startClockDrone();
      }
    }
  });

  // Preset atmosphere selector
  selectPreset.addEventListener("change", (e) => {
    audio.loadAtmospherePreset(e.target.value);
    closeSidebarControl();
  });

  // Master Volume slider
  sliderMasterVolume.addEventListener("input", (e) => {
    const val = e.target.value;
    valMasterVolume.textContent = val + "%";
    audio.setMasterVolume(val);
  });

  // --- SYNTH SIDEBAR CONTROLS ---
  const sidebarPlaceholder = document.querySelector(".sidebar-placeholder");
  const sidebarControls = document.getElementById("synth-controls");
  const btnCloseSidebar = document.getElementById("btn-close-sidebar");
  
  const nodeNameEl = document.getElementById("node-name");
  const toneBtns = document.querySelectorAll(".tone-btn");
  
  const sliderFreq = document.getElementById("slider-freq");
  const valFreq = document.getElementById("val-freq");
  const sliderFilter = document.getElementById("slider-filter");
  const valFilter = document.getElementById("val-filter");
  const sliderQ = document.getElementById("slider-q");
  const valQ = document.getElementById("val-q");
  const sliderLfoRate = document.getElementById("slider-lfo-rate");
  const valLfoRate = document.getElementById("val-lfo-rate");
  const sliderLfoDepth = document.getElementById("slider-lfo-depth");
  const valLfoDepth = document.getElementById("val-lfo-depth");
  const sliderDelay = document.getElementById("slider-delay");
  const valDelay = document.getElementById("val-delay");
  const sliderFeedback = document.getElementById("slider-feedback");
  const valFeedback = document.getElementById("val-feedback");
  
  const btnNodeMute = document.getElementById("btn-node-mute");
  const btnNodeSolo = document.getElementById("btn-node-solo");

  let activeNodeId = null;

  function openSidebarControl(node) {
    activeNodeId = node.id;
    
    // Hide default placeholder, display controls
    sidebarPlaceholder.classList.add("hidden");
    sidebarControls.classList.remove("hidden");
    
    // Populate panel values
    nodeNameEl.textContent = node.name;
    
    // Select tone button style
    toneBtns.forEach(btn => {
      btn.classList.remove("active");
      if (btn.dataset.type === node.type) {
        btn.classList.add("active");
      }
    });
    
    // Sliders
    sliderFreq.value = node.baseFreq;
    valFreq.textContent = node.baseFreq + " Hz";
    
    sliderFilter.value = node.filterCutoff;
    valFilter.textContent = node.filterCutoff + " Hz";
    
    sliderQ.value = node.filterQ;
    valQ.textContent = node.filterQ.toFixed(1);
    
    sliderLfoRate.value = node.lfoRate;
    valLfoRate.textContent = node.lfoRate.toFixed(2) + " Hz";
    
    sliderLfoDepth.value = node.lfoDepth;
    valLfoDepth.textContent = node.lfoDepth + "%";
    
    sliderDelay.value = node.delayTime;
    valDelay.textContent = node.delayTime.toFixed(2) + "s";
    
    sliderFeedback.value = Math.round(node.delayFeedback * 100);
    valFeedback.textContent = Math.round(node.delayFeedback * 100) + "%";
    
    // Adjust mute/solo button visual states
    btnNodeMute.classList.toggle("active", node.mute);
    btnNodeMute.textContent = node.mute ? "Unmute Node" : "Mute Node";
    
    btnNodeSolo.classList.toggle("active", node.solo);
  }

  function closeSidebarControl() {
    activeNodeId = null;
    sidebarPlaceholder.classList.remove("hidden");
    sidebarControls.classList.add("hidden");
  }

  btnCloseSidebar.addEventListener("click", closeSidebarControl);

  // Tone selector buttons
  toneBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (activeNodeId === null) return;
      toneBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      audio.updateNodeOscType(activeNodeId, btn.dataset.type);
    });
  });

  // Slider controls bindings
  sliderFreq.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = e.target.value;
    valFreq.textContent = val + " Hz";
    audio.updateNodeFreq(activeNodeId, val);
  });

  sliderFilter.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = e.target.value;
    valFilter.textContent = val + " Hz";
    audio.updateNodeFilter(activeNodeId, val);
  });

  sliderQ.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = parseFloat(e.target.value);
    valQ.textContent = val.toFixed(1);
    audio.updateNodeQ(activeNodeId, val);
  });

  sliderLfoRate.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = parseFloat(e.target.value);
    valLfoRate.textContent = val.toFixed(2) + " Hz";
    audio.updateNodeLfoRate(activeNodeId, val);
  });

  sliderLfoDepth.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = e.target.value;
    valLfoDepth.textContent = val + "%";
    audio.updateNodeLfoDepth(activeNodeId, val);
  });

  sliderDelay.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = parseFloat(e.target.value);
    valDelay.textContent = val.toFixed(2) + "s";
    audio.updateNodeDelayTime(activeNodeId, val);
  });

  sliderFeedback.addEventListener("input", (e) => {
    if (activeNodeId === null) return;
    const val = e.target.value;
    valFeedback.textContent = val + "%";
    audio.updateNodeDelayFeedback(activeNodeId, val);
  });

  // Mute Node
  btnNodeMute.addEventListener("click", () => {
    if (activeNodeId === null) return;
    const isMuted = audio.toggleNodeMute(activeNodeId);
    btnNodeMute.classList.toggle("active", isMuted);
    btnNodeMute.textContent = isMuted ? "Unmute Node" : "Mute Node";
  });

  // Solo Node
  btnNodeSolo.addEventListener("click", () => {
    if (activeNodeId === null) return;
    const isSolo = audio.toggleNodeSolo(activeNodeId);
    btnNodeSolo.classList.toggle("active", isSolo);
    
    // Mute buttons visual states on other sidebar nodes might update since solo affects them
    const activeNode = audio.nodes.find(n => n.id === activeNodeId);
    btnNodeMute.classList.toggle("active", activeNode.mute);
    btnNodeMute.textContent = activeNode.mute ? "Unmute Node" : "Mute Node";
  });


  // --- MORSE TRANSMITTER INTERFACE HANDLERS ---
  const morseText = document.getElementById("morse-text");
  const charCount = document.getElementById("char-count");
  const sliderMorseWpm = document.getElementById("slider-morse-wpm");
  const valMorseWpm = document.getElementById("val-morse-wpm");
  const sliderMorsePitch = document.getElementById("slider-morse-pitch");
  const valMorsePitch = document.getElementById("val-morse-pitch");
  
  const btnMorsePlay = document.getElementById("btn-morse-play");
  const btnMorseStop = document.getElementById("btn-morse-stop");
  
  const terminalBody = document.getElementById("morse-terminal-body");
  const morseBeacon = document.getElementById("morse-beacon");
  const morseCharDisplay = document.getElementById("morse-char-display");

  // Character counter limits
  morseText.addEventListener("input", (e) => {
    charCount.textContent = e.target.value.length;
  });

  // Morse settings
  sliderMorseWpm.addEventListener("input", (e) => {
    valMorseWpm.textContent = e.target.value + " WPM";
  });

  sliderMorsePitch.addEventListener("input", (e) => {
    valMorsePitch.textContent = e.target.value + " Hz";
    if (morse) morse.updatePitch(parseFloat(e.target.value));
  });

  // Play Morse Action
  btnMorsePlay.addEventListener("click", () => {
    const text = morseText.value.trim();
    if (!text) return;
    
    const wpm = parseInt(sliderMorseWpm.value);
    const pitch = parseInt(sliderMorsePitch.value);
    
    // Disable inputs
    btnMorsePlay.classList.add("disabled");
    btnMorsePlay.disabled = true;
    btnMorseStop.classList.remove("disabled");
    btnMorseStop.disabled = false;
    
    // Log transmission init
    appendTerminalLine(`> TRANSMISSION INITIALIZED: "${text.toUpperCase()}"`, "send");
    
    morse.play(
      text,
      wpm,
      pitch,
      (event) => {
        // Sequenced events callback
        if (event.type === 'KEY_DOWN') {
          morseBeacon.classList.add("active");
        } else if (event.type === 'KEY_UP') {
          morseBeacon.classList.remove("active");
        } else if (event.type === 'CHAR') {
          morseCharDisplay.textContent = event.char;
          appendTerminalLine(`[${event.char}]   ${event.code}`, "morse-code");
        }
      },
      () => {
        // Done callback
        appendTerminalLine(`> TRANSMISSION COMPLETED. SUCCESS.`, "system");
        resetMorseButtons();
      }
    );
  });

  // Stop Morse Action
  btnMorseStop.addEventListener("click", () => {
    if (morse) {
      morse.stop();
      appendTerminalLine(`> TRANSMISSION HALTED BY COMMAND.`, "system");
      resetMorseButtons();
    }
  });

  function resetMorseButtons() {
    btnMorsePlay.classList.remove("disabled");
    btnMorsePlay.disabled = false;
    btnMorseStop.classList.add("disabled");
    btnMorseStop.disabled = true;
    
    morseBeacon.classList.remove("active");
    morseCharDisplay.textContent = "-";
  }

  function appendTerminalLine(text, className) {
    const line = document.createElement("div");
    line.className = `terminal-line ${className}`;
    line.textContent = text;
    terminalBody.appendChild(line);
    
    // Auto scroll to bottom
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // --- VISUALIZER PRESETS ---
  const visOptBtns = document.querySelectorAll(".vis-opt-btn");
  
  visOptBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      visOptBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      if (visualizer) {
        visualizer.setPreset(btn.dataset.preset);
      }
    });
  });

});
