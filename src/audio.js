// Aether Web Audio API Synthesis Engine

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyzer = null;
    this.initialized = false;
    this.isPlaying = false;
    
    // Core references
    this.nodes = [];
    this.clockSynth = null;
    this.morseSynth = null;
    
    // Ambient Noise Buffer for wind effects
    this.noiseBuffer = null;
    
    // Audio telemetry parameters
    this.activeOscCount = 0;
  }

  init() {
    if (this.initialized) return;

    // Support standard and webkit audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Node Graph Setup
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime); // Default volume 75%
    
    this.analyzer = this.ctx.createAnalyser();
    this.analyzer.fftSize = 512;
    
    // Connect Graph
    this.masterGain.connect(this.analyzer);
    this.analyzer.connect(this.ctx.destination);
    
    // Generate static assets like noise buffers
    this.createNoiseBuffer();
    
    // Initialize Sub-Systems
    this.initConstellationSynths();
    this.initClockSynth();
    this.initMorseSynth();

    this.initialized = true;
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    
    // Start nodes if they aren't playing
    this.nodes.forEach(node => {
      if (node.mute) return;
      this.fadeInNode(node);
    });
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
    this.isPlaying = false;
  }

  setMasterVolume(percent) {
    if (!this.masterGain) return;
    const vol = Math.max(0, Math.min(100, percent)) / 100;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  createNoiseBuffer() {
    const bufferSize = 2 * this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    // Fill with white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  // --- CONSTELLATION SYNTHS ---
  initConstellationSynths() {
    // We define 5 default nodes representing different celestial elements.
    // They will float around in the constellation canvas space.
    const defaultSpecs = [
      { id: 0, name: "Nebula Drone", type: "sine", baseFreq: 110, filterCutoff: 300, filterQ: 2.0, lfoRate: 0.2, lfoDepth: 60, delayTime: 0.4, delayFeedback: 0.4, x: 0.2, y: 0.3, color: "#7c3aed" },
      { id: 1, name: "Aether Chimes", type: "triangle", baseFreq: 330, filterCutoff: 1200, filterQ: 4.0, lfoRate: 0.8, lfoDepth: 30, delayTime: 0.6, delayFeedback: 0.6, x: 0.7, y: 0.2, color: "#06b6d4", isChimes: true },
      { id: 2, name: "Solar Wind", type: "noise", baseFreq: 220, filterCutoff: 600, filterQ: 1.0, lfoRate: 0.08, lfoDepth: 80, delayTime: 0.5, delayFeedback: 0.3, x: 0.8, y: 0.7, color: "#ec4899" },
      { id: 3, name: "Star Dust Pulsar", type: "sawtooth", baseFreq: 165, filterCutoff: 900, filterQ: 1.5, lfoRate: 1.5, lfoDepth: 45, delayTime: 0.25, delayFeedback: 0.5, x: 0.3, y: 0.8, color: "#10b981", isArp: true },
      { id: 4, name: "Deep Abyssal", type: "square", baseFreq: 55, filterCutoff: 200, filterQ: 3.0, lfoRate: 0.1, lfoDepth: 50, delayTime: 0.35, delayFeedback: 0.2, x: 0.5, y: 0.5, color: "#f59e0b" }
    ];

    this.nodes = defaultSpecs.map(spec => this.buildSynthNode(spec));
  }

  buildSynthNode(spec) {
    const node = {
      ...spec,
      osc: null,
      noiseNode: null,
      filter: null,
      lfo: null,
      lfoGain: null,
      delayNode: null,
      delayGain: null,
      nodeGain: null,
      spatialGain: null,
      active: false,
      mute: false,
      solo: false,
      wasMuteBeforeSolo: null,
      volTarget: 0.25 // Node volume multiplier
    };

    return node;
  }

  fadeInNode(node) {
    if (!this.initialized || node.active) return;
    
    // 1. Core Source Setup
    const time = this.ctx.currentTime;
    
    node.nodeGain = this.ctx.createGain();
    node.nodeGain.gain.setValueAtTime(0, time);
    
    node.spatialGain = this.ctx.createGain();
    node.spatialGain.gain.setValueAtTime(0.01, time); // Driven by distance, starts muted

    node.filter = this.ctx.createBiquadFilter();
    node.filter.type = "lowpass";
    node.filter.frequency.setValueAtTime(node.filterCutoff, time);
    node.filter.Q.setValueAtTime(node.filterQ, time);

    // Filter LFO setup
    node.lfo = this.ctx.createOscillator();
    node.lfo.type = "sine";
    node.lfo.frequency.setValueAtTime(node.lfoRate, time);

    node.lfoGain = this.ctx.createGain();
    // Translate depth percent to frequency modulation range (e.g. up to 1000Hz sweep)
    const depthVal = (node.lfoDepth / 100) * node.filterCutoff;
    node.lfoGain.gain.setValueAtTime(depthVal, time);

    node.lfo.connect(node.lfoGain);
    node.lfoGain.connect(node.filter.frequency);
    node.lfo.start(time);

    // Delay Setup
    node.delayNode = this.ctx.createDelay(1.0);
    node.delayNode.delayTime.setValueAtTime(node.delayTime, time);
    
    node.delayGain = this.ctx.createGain();
    node.delayGain.gain.setValueAtTime(node.delayFeedback, time);

    // Feedback Loop
    node.delayNode.connect(node.delayGain);
    node.delayGain.connect(node.delayNode);

    // Oscillator or Noise Generation
    if (node.type === "noise") {
      node.noiseNode = this.ctx.createBufferSource();
      node.noiseNode.buffer = this.noiseBuffer;
      node.noiseNode.loop = true;
      node.noiseNode.connect(node.filter);
      node.noiseNode.start(time);
    } else {
      node.osc = this.ctx.createOscillator();
      node.osc.type = node.type;
      node.osc.frequency.setValueAtTime(node.baseFreq, time);
      node.osc.connect(node.filter);
      node.osc.start(time);
      this.activeOscCount++;
    }

    // Connect Filter to Node Output & Delay Output
    node.filter.connect(node.nodeGain);
    node.filter.connect(node.delayNode);
    node.delayNode.connect(node.nodeGain);

    // Connect node output to Spatial and Master
    node.nodeGain.connect(node.spatialGain);
    node.spatialGain.connect(this.masterGain);

    // Handle custom behaviors
    if (node.isChimes) {
      this.runChimeSequencer(node);
    } else if (node.isArp) {
      this.runArpSequencer(node);
    }

    // Fade in
    node.nodeGain.gain.setTargetAtTime(node.volTarget, time, 0.1);
    node.active = true;
  }

  fadeOutNode(node) {
    if (!node.active) return;
    const time = this.ctx.currentTime;
    
    // Halt sequencer chains so fadeInNode cannot stack duplicate timers
    if (node.chimeTimer) {
      clearTimeout(node.chimeTimer);
      node.chimeTimer = null;
    }
    if (node.arpTimer) {
      clearTimeout(node.arpTimer);
      node.arpTimer = null;
    }
    
    try {
      node.nodeGain.gain.setTargetAtTime(0, time, 0.05);
      
      setTimeout(() => {
        if (!node.active) return;
        
        // Clean up connections
        if (node.osc) {
          node.osc.stop();
          this.activeOscCount--;
        }
        if (node.noiseNode) {
          node.noiseNode.stop();
        }
        if (node.lfo) {
          node.lfo.stop();
        }
        
        // Disconnect node graph
        node.lfoGain.disconnect();
        node.filter.disconnect();
        node.delayNode.disconnect();
        node.delayGain.disconnect();
        node.nodeGain.disconnect();
        node.spatialGain.disconnect();
        
        node.osc = null;
        node.noiseNode = null;
        node.filter = null;
        node.lfo = null;
        node.lfoGain = null;
        node.delayNode = null;
        node.delayGain = null;
        node.nodeGain = null;
        node.spatialGain = null;
        node.active = false;
      }, 300);
    } catch (e) {
      console.warn("Error fading out node:", e);
      node.active = false;
    }
  }

  updateSpatialMixing(nodeId, distancePercent) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.spatialGain) return;
    
    // Distance percent ranges from 0 (at core center) to 1 (at outer edge)
    // Core center should be full volume, outer edge should be muted
    let spatialVol = Math.max(0, 1 - distancePercent);
    // Apply logarithmic curve for spatial blending
    spatialVol = Math.pow(spatialVol, 1.5);
    
    if (node.mute) spatialVol = 0;
    
    // Smooth transition
    node.spatialGain.gain.setTargetAtTime(spatialVol, this.ctx.currentTime, 0.08);
  }

  runChimeSequencer(node) {
    // Timer chain must always reschedule so sequencers survive pause/resume cycles
    if (this.isPlaying && !node.mute && node.osc && node.active) {
      const time = this.ctx.currentTime;

      const scale = [1.0, 1.25, 1.333, 1.5, 1.667, 2.0, 2.5, 3.0];
      const ratio = scale[Math.floor(Math.random() * scale.length)];
      const chimeFreq = node.baseFreq * ratio;

      node.osc.frequency.setValueAtTime(chimeFreq, time);

      if (node.filter) {
        node.filter.frequency.setValueAtTime(node.filterCutoff * 2, time);
        node.filter.frequency.exponentialRampToValueAtTime(node.filterCutoff * 0.2, time + 2.5);
      }
    }

    const nextInterval = 2000 + Math.random() * 4000;
    node.chimeTimer = setTimeout(() => this.runChimeSequencer(node), nextInterval);
  }

  runArpSequencer(node) {
    if (this.isPlaying && !node.mute && node.osc && node.active) {
      const time = this.ctx.currentTime;

      const chordRatios = [1.0, 1.2, 1.5, 1.8, 2.0, 2.4];
      if (!node.arpIndex) node.arpIndex = 0;

      const ratio = chordRatios[node.arpIndex % chordRatios.length];
      const targetFreq = node.baseFreq * ratio;

      node.osc.frequency.setValueAtTime(targetFreq, time);

      if (node.filter) {
        node.filter.frequency.setValueAtTime(node.filterCutoff * 3, time);
        node.filter.frequency.setTargetAtTime(node.filterCutoff, time, 0.05);
      }

      node.arpIndex++;
    }
    
    // Run arp beat determined by LFO rate slider
    const delayMs = 60000 / (node.lfoRate * 60 * 4); // Maps LFO rate to BPM divisions
    const clampedDelay = Math.max(80, Math.min(2000, delayMs)); // Safe clamp
    
    node.arpTimer = setTimeout(() => this.runArpSequencer(node), clampedDelay);
  }

  updateNodeFreq(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.baseFreq = parseFloat(val);
    if (node.osc && !node.isChimes && !node.isArp) {
      node.osc.frequency.setTargetAtTime(node.baseFreq, this.ctx.currentTime, 0.05);
    }
  }

  updateNodeFilter(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.filterCutoff = parseFloat(val);
    if (node.filter) {
      node.filter.frequency.setTargetAtTime(node.filterCutoff, this.ctx.currentTime, 0.05);
    }
    // Update LFO gain values as filter ranges shift
    if (node.lfoGain) {
      const depthVal = (node.lfoDepth / 100) * node.filterCutoff;
      node.lfoGain.gain.setTargetAtTime(depthVal, this.ctx.currentTime, 0.05);
    }
  }

  updateNodeQ(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.filterQ = parseFloat(val);
    if (node.filter) {
      node.filter.Q.setTargetAtTime(node.filterQ, this.ctx.currentTime, 0.05);
    }
  }

  updateNodeLfoRate(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.lfoRate = parseFloat(val);
    if (node.lfo) {
      node.lfo.frequency.setTargetAtTime(node.lfoRate, this.ctx.currentTime, 0.05);
    }
  }

  updateNodeLfoDepth(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.lfoDepth = parseFloat(val);
    if (node.lfoGain && node.filterCutoff) {
      const depthVal = (node.lfoDepth / 100) * node.filterCutoff;
      node.lfoGain.gain.setTargetAtTime(depthVal, this.ctx.currentTime, 0.05);
    }
  }

  updateNodeDelayTime(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.delayTime = parseFloat(val);
    if (node.delayNode) {
      node.delayNode.delayTime.setTargetAtTime(node.delayTime, this.ctx.currentTime, 0.1);
    }
  }

  updateNodeDelayFeedback(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.delayFeedback = parseFloat(val) / 100;
    if (node.delayGain) {
      node.delayGain.gain.setTargetAtTime(node.delayFeedback, this.ctx.currentTime, 0.05);
    }
  }

  // Bring a node's output in line with its current mute state.
  // Nodes muted at engine start have no graph yet, so they must be built on unmute.
  applyNodeAudibility(node) {
    if (node.mute) {
      if (node.spatialGain) {
        node.spatialGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }
    
    if (this.isPlaying && !node.active) {
      this.fadeInNode(node);
    }
  }

  toggleNodeMute(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    node.mute = !node.mute;
    
    this.applyNodeAudibility(node);
    return node.mute;
  }

  toggleNodeSolo(nodeId) {
    const targetNode = this.nodes.find(n => n.id === nodeId);
    if (!targetNode) return false;
    
    const wasAnySolo = this.nodes.some(n => n.solo);
    targetNode.solo = !targetNode.solo;
    const isAnySolo = this.nodes.some(n => n.solo);

    // Only snapshot on the transition into solo mode, otherwise later toggles
    // would overwrite the backup with solo-induced mute states
    if (isAnySolo && !wasAnySolo) {
      this.nodes.forEach(node => {
        node.wasMuteBeforeSolo = node.mute;
      });
    }

    this.nodes.forEach(node => {
      if (isAnySolo) {
        node.mute = !node.solo;
      } else {
        node.mute = node.wasMuteBeforeSolo ?? false;
        node.wasMuteBeforeSolo = null;
      }
      this.applyNodeAudibility(node);
    });

    return targetNode.solo;
  }

  updateNodeOscType(nodeId, type) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.type = type;
    
    // We recreate the oscillator element if type shifts and node is active
    if (node.active) {
      this.fadeOutNode(node);
      setTimeout(() => {
        this.fadeInNode(node);
      }, 400);
    }
  }

  // --- CHRONO-RESONATOR SYNTH (GENERATE TIME SOUNDS) ---
  initClockSynth() {
    this.clockSynth = {
      voices: [], // Sub additive synth voices
      filters: [],
      masterGain: null,
      rootFreq: null,
      isActive: false
    };
  }

  startClockDrone() {
    if (!this.initialized || this.clockSynth.isActive) return;
    
    const time = this.ctx.currentTime;
    
    this.clockSynth.masterGain = this.ctx.createGain();
    this.clockSynth.masterGain.gain.setValueAtTime(0, time);
    this.clockSynth.masterGain.connect(this.masterGain);
    
    // Start with 4 drone voices
    // We generate simple low-pass filtered oscillators for lush chords
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const voiceGain = this.ctx.createGain();
      
      osc.type = "sine";
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(150, time);
      filter.Q.setValueAtTime(2.0, time);
      
      voiceGain.gain.setValueAtTime(0.2, time);
      
      // Connect Graph
      osc.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(this.clockSynth.masterGain);
      
      osc.start(time);
      this.activeOscCount++;
      
      this.clockSynth.voices.push({ osc, voiceGain });
      this.clockSynth.filters.push(filter);
    }
    
    // Slow fade in master gain to make it smooth
    this.clockSynth.masterGain.gain.setTargetAtTime(0.4, time, 1.5);
    this.clockSynth.isActive = true;
    
    // Initial clock tune update
    this.updateClockHarmonies();
  }

  stopClockDrone() {
    if (!this.clockSynth.isActive) return;
    const time = this.ctx.currentTime;
    
    // Snapshot the current generation so a restart during the fade cannot
    // have its fresh voices torn down by this teardown timer
    const oldMasterGain = this.clockSynth.masterGain;
    const oldVoices = this.clockSynth.voices;
    
    this.clockSynth.isActive = false;
    this.clockSynth.voices = [];
    this.clockSynth.filters = [];
    this.clockSynth.masterGain = null;
    this.clockSynth.rootFreq = null;
    
    oldMasterGain.gain.setTargetAtTime(0, time, 0.2);
    
    setTimeout(() => {
      oldVoices.forEach(voice => {
        voice.osc.stop();
        this.activeOscCount--;
      });
      oldMasterGain.disconnect();
    }, 500);
  }

  updateClockHarmonies() {
    if (!this.clockSynth.isActive || !this.isPlaying) return;
    
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    
    // Map hour to Root Frequency
    // 24-hour cycle maps to root frequencies on C major/minor chords
    // Hour 0-23 maps to MIDI notes 36 to 59 (Low range C2-B3)
    const baseRootNotes = [
      65.41,  // C2
      69.30,  // C#2
      73.42,  // D2
      77.78,  // D#2
      82.41,  // E2
      87.31,  // F2
      92.50,  // F#2
      98.00,  // G2
      103.83, // G#2
      110.00, // A2
      116.54, // A#2
      123.47  // B2
    ];
    
    const rootFreq = baseRootNotes[hrs % 12];
    this.clockSynth.rootFreq = rootFreq;

    // Minute maps to chord structure (minor 9, major 7, suspended, etc.)
    // Select different harmonic multiples of root based on minute ranges
    let scaleRatios;
    let chordName;

    const chordChoice = Math.floor(mins / 15);
    if (chordChoice === 0) {
      scaleRatios = [1.0, 1.2, 1.5, 1.8]; // Minor 7th
      chordName = "Minor 7th (Dreamy)";
    } else if (chordChoice === 1) {
      scaleRatios = [1.0, 1.25, 1.5, 1.875]; // Major 7th
      chordName = "Major 7th (Serene)";
    } else if (chordChoice === 2) {
      scaleRatios = [1.0, 1.333, 1.5, 2.0]; // Sus 4 / Octave
      chordName = "Suspended 4th (Tense)";
    } else {
      scaleRatios = [1.0, 1.189, 1.414, 1.682]; // Diminished / Tritone
      chordName = "Diminished (Abyssal)";
    }
    
    const time = this.ctx.currentTime;
    
    // Update voice frequencies
    this.clockSynth.voices.forEach((voice, i) => {
      const targetFreq = rootFreq * scaleRatios[i];
      voice.osc.frequency.setTargetAtTime(targetFreq, time, 0.5);
    });
    
    // Apply current sweep position immediately for smooth handoff
    this.updateClockSweep((secs + (Date.now() % 1000) / 1000) / 60);
    
    // Export data to dispatch to UI
    return {
      rootFreq: rootFreq.toFixed(1) + " Hz",
      chordName: chordName,
      activeVoices: this.clockSynth.voices.length
    };
  }

  updateClockSweep(progress) {
    if (!this.clockSynth.isActive || !this.isPlaying || !this.clockSynth.rootFreq) return;
    
    const time = this.ctx.currentTime;
    
    // Cutoff frequency opens and closes in synchronization with seconds
    // Creating a mechanical clock breathing sweep
    const cutoffBase = 120 + this.clockSynth.rootFreq;
    const targetCutoff = cutoffBase + (progress * 500); // Sweep up to ~600Hz
    
    this.clockSynth.filters.forEach(filter => {
      filter.frequency.setTargetAtTime(targetCutoff, time, 0.08);
    });
  }

  // --- MORSE ENGINE ---
  initMorseSynth() {
    this.morseSynth = {
      osc: null,
      gate: null,
      delayNode: null,
      delayGain: null,
      isActive: false
    };
  }

  startMorseTransmission(pitchHz) {
    if (!this.initialized) return;
    const time = this.ctx.currentTime;
    
    this.morseSynth.gate = this.ctx.createGain();
    this.morseSynth.gate.gain.setValueAtTime(0, time);
    
    this.morseSynth.osc = this.ctx.createOscillator();
    this.morseSynth.osc.type = "sine";
    this.morseSynth.osc.frequency.setValueAtTime(pitchHz, time);
    
    this.morseSynth.delayNode = this.ctx.createDelay(1.0);
    this.morseSynth.delayNode.delayTime.setValueAtTime(0.35, time); // Echo
    
    this.morseSynth.delayGain = this.ctx.createGain();
    this.morseSynth.delayGain.gain.setValueAtTime(0.45, time); // Ringing echo feedback
    
    // Feedback loop connections
    this.morseSynth.delayNode.connect(this.morseSynth.delayGain);
    this.morseSynth.delayGain.connect(this.morseSynth.delayNode);
    
    // Connections
    this.morseSynth.osc.connect(this.morseSynth.gate);
    this.morseSynth.gate.connect(this.masterGain);
    this.morseSynth.gate.connect(this.morseSynth.delayNode);
    this.morseSynth.delayNode.connect(this.masterGain);
    
    this.morseSynth.osc.start(time);
    this.activeOscCount++;
    
    this.morseSynth.isActive = true;
  }

  triggerMorseKey(state) {
    if (!this.morseSynth.isActive) return;
    const time = this.ctx.currentTime;
    
    if (state === true) {
      // Key down (gate opens)
      // Small attack ramp to prevent speaker clicks
      this.morseSynth.gate.gain.setTargetAtTime(0.2, time, 0.005);
    } else {
      // Key up (gate closes)
      // Small decay ramp
      this.morseSynth.gate.gain.setTargetAtTime(0, time, 0.015);
    }
  }

  stopMorseTransmission() {
    if (!this.morseSynth.isActive) return;
    const time = this.ctx.currentTime;
    
    try {
      this.morseSynth.osc.stop(time);
      this.activeOscCount--;
      
      this.morseSynth.osc.disconnect();
      this.morseSynth.gate.disconnect();
      this.morseSynth.delayNode.disconnect();
      this.morseSynth.delayGain.disconnect();
      
      this.morseSynth.osc = null;
      this.morseSynth.gate = null;
      this.morseSynth.delayNode = null;
      this.morseSynth.delayGain = null;
      this.morseSynth.isActive = false;
    } catch (e) {
      console.warn("Error stopping morse synth:", e);
      this.morseSynth.isActive = false;
    }
  }

  // --- PRESET LOADER (ATMOSPHERE CONTROLS) ---
  loadAtmospherePreset(presetName) {
    if (!this.initialized) return;
    
    const time = this.ctx.currentTime;
    
    // Presets definition
    const presets = {
      cosmic: [
        { id: 0, type: "sine", baseFreq: 110, filterCutoff: 300, filterQ: 2, lfoRate: 0.2, lfoDepth: 60, delayTime: 0.4, delayFeedback: 40, mute: false },
        { id: 1, type: "triangle", baseFreq: 330, filterCutoff: 1200, filterQ: 4, lfoRate: 0.8, lfoDepth: 30, delayTime: 0.6, delayFeedback: 60, mute: false },
        { id: 2, type: "noise", baseFreq: 220, filterCutoff: 600, filterQ: 1, lfoRate: 0.08, lfoDepth: 80, delayTime: 0.5, delayFeedback: 30, mute: false },
        { id: 3, type: "sawtooth", baseFreq: 165, filterCutoff: 900, filterQ: 1.5, lfoRate: 1.5, lfoDepth: 45, delayTime: 0.25, delayFeedback: 50, mute: false },
        { id: 4, type: "square", baseFreq: 55, filterCutoff: 200, filterQ: 3, lfoRate: 0.1, lfoDepth: 50, delayTime: 0.35, delayFeedback: 20, mute: false }
      ],
      ocean: [
        { id: 0, type: "sine", baseFreq: 73.4, filterCutoff: 150, filterQ: 4, lfoRate: 0.05, lfoDepth: 90, delayTime: 0.8, delayFeedback: 70, mute: false },
        { id: 1, type: "triangle", baseFreq: 146.8, filterCutoff: 400, filterQ: 2, lfoRate: 0.15, lfoDepth: 50, delayTime: 0.7, delayFeedback: 40, mute: false },
        { id: 2, type: "noise", baseFreq: 100, filterCutoff: 250, filterQ: 0.5, lfoRate: 0.04, lfoDepth: 95, delayTime: 0.6, delayFeedback: 10, mute: false },
        { id: 3, type: "sine", baseFreq: 220, filterCutoff: 800, filterQ: 1.0, lfoRate: 0.3, lfoDepth: 25, delayTime: 0.5, delayFeedback: 50, mute: true }, // Mute secondary elements for deep abyss
        { id: 4, type: "square", baseFreq: 36.7, filterCutoff: 100, filterQ: 5, lfoRate: 0.02, lfoDepth: 60, delayTime: 0.9, delayFeedback: 80, mute: false }
      ],
      retro: [
        { id: 0, type: "sawtooth", baseFreq: 130.8, filterCutoff: 1200, filterQ: 3, lfoRate: 0.4, lfoDepth: 70, delayTime: 0.3, delayFeedback: 50, mute: false },
        { id: 1, type: "triangle", baseFreq: 523.2, filterCutoff: 1800, filterQ: 6, lfoRate: 1.2, lfoDepth: 40, delayTime: 0.45, delayFeedback: 60, mute: false },
        { id: 2, type: "noise", baseFreq: 440, filterCutoff: 1500, filterQ: 2, lfoRate: 2.0, lfoDepth: 30, delayTime: 0.15, delayFeedback: 20, mute: true },
        { id: 3, type: "square", baseFreq: 196, filterCutoff: 1000, filterQ: 1.5, lfoRate: 3.0, lfoDepth: 50, delayTime: 0.25, delayFeedback: 45, mute: false },
        { id: 4, type: "sawtooth", baseFreq: 65.4, filterCutoff: 500, filterQ: 2, lfoRate: 0.5, lfoDepth: 40, delayTime: 0.35, delayFeedback: 30, mute: false }
      ],
      rain: [
        { id: 0, type: "sine", baseFreq: 98, filterCutoff: 400, filterQ: 1, lfoRate: 0.1, lfoDepth: 50, delayTime: 0.5, delayFeedback: 30, mute: false },
        { id: 1, type: "triangle", baseFreq: 293.6, filterCutoff: 900, filterQ: 2, lfoRate: 0.5, lfoDepth: 40, delayTime: 0.75, delayFeedback: 75, mute: false },
        { id: 2, type: "noise", baseFreq: 200, filterCutoff: 2000, filterQ: 0.8, lfoRate: 0.05, lfoDepth: 99, delayTime: 0.3, delayFeedback: 5, mute: false }, // Heavy noise rain
        { id: 3, type: "sine", baseFreq: 146.8, filterCutoff: 600, filterQ: 3, lfoRate: 0.3, lfoDepth: 80, delayTime: 0.4, delayFeedback: 50, mute: false },
        { id: 4, type: "square", baseFreq: 49, filterCutoff: 180, filterQ: 4, lfoRate: 0.08, lfoDepth: 60, delayTime: 0.6, delayFeedback: 40, mute: false }
      ]
    };

    const targetPreset = presets[presetName] || presets.cosmic;
    
    // Applying a preset clears any solo states so it can't fight the new mix
    this.nodes.forEach(n => {
      n.solo = false;
      n.wasMuteBeforeSolo = null;
    });
    
    // Apply changes smoothly to existing running nodes
    targetPreset.forEach((data) => {
      const node = this.nodes.find(n => n.id === data.id);
      if (!node) return;
      
      // Update variables
      node.type = data.type;
      node.baseFreq = data.baseFreq;
      node.filterCutoff = data.filterCutoff;
      node.filterQ = data.filterQ;
      node.lfoRate = data.lfoRate;
      node.lfoDepth = data.lfoDepth;
      node.delayTime = data.delayTime;
      node.delayFeedback = data.delayFeedback / 100;
      node.mute = data.mute;
      
      // Wake up silent nodes that the preset enables while engine runs
      if (this.isPlaying && !node.mute && !node.active) {
        this.fadeInNode(node);
        return;
      }
      
      // If node is currently running, rebuild it smoothly
      if (node.active) {
        this.fadeOutNode(node);
        setTimeout(() => {
          if (!node.mute && this.isPlaying) {
            this.fadeInNode(node);
          }
        }, 400);
      }
    });
  }
}
