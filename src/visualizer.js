// Aether Canvas Visualizer Engine

export class Visualizer {
  constructor(mainCanvas, sparklineCanvas, audioEngine) {
    this.canvas = mainCanvas;
    this.ctx = mainCanvas.getContext("2d");
    this.sparklineCanvas = sparklineCanvas;
    this.sCtx = sparklineCanvas.getContext("2d");
    this.audio = audioEngine;
    
    this.preset = "circular"; // Default preset
    this.animationId = null;
    
    // Analyzer variables
    this.freqData = null;
    this.timeData = null;
    
    // Particle system for "nebula" preset
    this.particles = [];
    this.maxParticles = 120;
    this.initParticles();
    
    // Handle resizing
    this.resize();
    window.addEventListener("resize", () => this.resize());
    
    // Waveform phase shifts
    this.wavePhase = 0;
  }

  resize() {
    if (this.canvas) {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    if (this.sparklineCanvas) {
      const rect = this.sparklineCanvas.parentElement.getBoundingClientRect();
      this.sparklineCanvas.width = rect.width * window.devicePixelRatio;
      this.sparklineCanvas.height = rect.height * window.devicePixelRatio;
      this.sCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomPos = false) {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.2 + Math.random() * 1.5;
    
    return {
      x: randomPos ? Math.random() * w : w / 2,
      y: randomPos ? Math.random() * h : h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 4,
      alpha: randomPos ? Math.random() * 0.7 : 0.8,
      decay: 0.002 + Math.random() * 0.008,
      color: `hsla(${180 + Math.random() * 120}, 75%, 65%, `
    };
  }

  setPreset(presetName) {
    this.preset = presetName;
  }

  start() {
    if (this.animationId) return;
    
    const bufferLength = this.audio.analyzer ? this.audio.analyzer.frequencyBinCount : 256;
    this.freqData = new Uint8Array(bufferLength);
    this.timeData = new Uint8Array(bufferLength);
    
    const renderLoop = () => {
      this.render();
      this.renderSparkline();
      this.animationId = requestAnimationFrame(renderLoop);
    };
    
    this.animationId = requestAnimationFrame(renderLoop);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    // Clear canvas with subtle transparency for trails
    this.ctx.fillStyle = "rgba(4, 2, 9, 0.15)";
    this.ctx.fillRect(0, 0, w, h);
    
    if (!this.audio.initialized || !this.audio.isPlaying) {
      this.renderIdle(w, h);
      return;
    }
    
    // Fetch telemetry
    this.audio.analyzer.getByteFrequencyData(this.freqData);
    this.audio.analyzer.getByteTimeDomainData(this.timeData);
    
    switch (this.preset) {
      case "circular":
        this.renderCircular(w, h);
        break;
      case "nebula":
        this.renderNebula(w, h);
        break;
      case "waves":
        this.renderWaves(w, h);
        break;
    }
  }

  // Idle visualizer state when no audio playing
  renderIdle(w, h) {
    this.ctx.strokeStyle = "rgba(124, 58, 237, 0.2)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    // Draw a flat baseline with sine oscillations
    const centerY = h / 2;
    this.ctx.moveTo(0, centerY);
    
    for (let x = 0; x < w; x++) {
      const y = centerY + Math.sin(x * 0.01 + Date.now() * 0.002) * 15;
      this.ctx.lineTo(x, y);
    }
    
    this.ctx.stroke();
  }

  // Preset 1: Hyper-Spectrum (3D circle bars)
  renderCircular(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(cx, cy) * 0.45;
    
    // Draw glowing center ring
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = "rgba(6, 182, 212, 0.4)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // Reset shadow
    
    const numBars = 160;
    const step = (Math.PI * 2) / numBars;
    
    for (let i = 0; i < numBars; i++) {
      // Index frequency data array
      const dataIdx = Math.floor((i / numBars) * (this.freqData.length * 0.7));
      const value = this.freqData[dataIdx];
      
      const barHeight = (value / 255) * (Math.min(cx, cy) * 0.4);
      const angle = i * step + Date.now() * 0.0001; // Slow spin
      
      const startX = cx + Math.cos(angle) * baseRadius;
      const startY = cy + Math.sin(angle) * baseRadius;
      const endX = cx + Math.cos(angle) * (baseRadius + barHeight);
      const endY = cy + Math.sin(angle) * (baseRadius + barHeight);
      
      // Calculate color based on index and height
      const hue = 180 + (i / numBars) * 120;
      this.ctx.strokeStyle = `hsla(${hue}, 85%, 60%, ${0.3 + (value / 255) * 0.7})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }

  // Preset 2: Nebula Pulse (particles modulated by frequency)
  renderNebula(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    
    // Average sub-bass registers (bin 0 to 12)
    let bassSum = 0;
    for (let i = 0; i < 12; i++) {
      bassSum += this.freqData[i];
    }
    const bass = bassSum / 12;
    const bassNormalized = bass / 255; // 0 to 1
    
    // Draw central nebula core
    const coreRad = 60 + bassNormalized * 50;
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRad);
    grad.addColorStop(0, "rgba(124, 58, 237, 0.4)");
    grad.addColorStop(0.5, "rgba(236, 72, 153, 0.15)");
    grad.addColorStop(1, "rgba(4, 2, 9, 0)");
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, coreRad, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw frequency circles
    this.ctx.strokeStyle = "rgba(6, 182, 212, 0.05)";
    this.ctx.lineWidth = 1;
    for (let r = 100; r < Math.min(w, h); r += 80) {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r + bassNormalized * 30, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Process and draw particles
    this.particles.forEach((p, idx) => {
      // Speed multiplier driven by bass
      const speedMult = 1.0 + bassNormalized * 5.0;
      
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;
      p.alpha -= p.decay;
      
      // Draw particle
      this.ctx.fillStyle = p.color + p.alpha + ")";
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = `hsla(180, 80%, 50%, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size + bassNormalized * 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Recycle particle if faded or out of bounds
      if (p.alpha <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        this.particles[idx] = this.createParticle(false);
      }
    });
    this.ctx.shadowBlur = 0; // Reset shadow
  }

  // Preset 3: Aether Waves (translucent gradient ribbons)
  renderWaves(w, h) {
    const centerY = h / 2;
    this.wavePhase += 0.015;
    
    const sliceWidth = w / this.timeData.length;
    
    // Draw 3 layers of waves with phase shifts
    const layers = [
      { color: "rgba(124, 58, 237, 0.15)", outline: "rgba(124, 58, 237, 0.7)", offset: 0, ampMult: 0.8 },
      { color: "rgba(6, 182, 212, 0.1)", outline: "rgba(6, 182, 212, 0.6)", offset: Math.PI / 3, ampMult: 1.0 },
      { color: "rgba(236, 72, 153, 0.08)", outline: "rgba(236, 72, 153, 0.5)", offset: (2 * Math.PI) / 3, ampMult: 0.6 }
    ];
    
    layers.forEach(layer => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = layer.outline;
      this.ctx.lineWidth = 2.5;
      this.ctx.fillStyle = layer.color;
      
      this.ctx.moveTo(0, centerY);
      
      for (let i = 0; i < this.timeData.length; i++) {
        // Read time data amplitude (-1 to 1)
        const amp = (this.timeData[i] - 128) / 128;
        
        // Form a pretty sine modulation pattern
        const sineMod = Math.sin((i * 0.05) + this.wavePhase + layer.offset);
        const y = centerY + (amp * 120 * layer.ampMult) + (sineMod * 15);
        const x = i * sliceWidth;
        
        this.ctx.lineTo(x, y);
      }
      
      // Close wave path for gradient fill
      this.ctx.lineTo(w, h);
      this.ctx.lineTo(0, h);
      this.ctx.closePath();
      
      this.ctx.fill();
      this.ctx.stroke();
    });
  }

  // Draw bottom sparkline analyzer graph
  renderSparkline() {
    if (!this.sparklineCanvas) return;
    
    const sw = this.sparklineCanvas.width / window.devicePixelRatio;
    const sh = this.sparklineCanvas.height / window.devicePixelRatio;
    
    this.sCtx.clearRect(0, 0, sw, sh);
    this.sCtx.lineWidth = 1.5;
    this.sCtx.strokeStyle = "rgba(6, 182, 212, 0.7)";
    
    // Draw soft backing pulse
    this.sCtx.beginPath();
    this.sCtx.moveTo(0, sh / 2);
    
    if (this.audio.initialized && this.audio.isPlaying && this.timeData) {
      const sliceWidth = sw / this.timeData.length;
      
      for (let i = 0; i < this.timeData.length; i++) {
        const amp = (this.timeData[i] - 128) / 128;
        const x = i * sliceWidth;
        const y = sh / 2 + (amp * (sh * 0.4));
        this.sCtx.lineTo(x, y);
      }
    } else {
      // Silent line
      this.sCtx.lineTo(sw, sh / 2);
    }
    
    this.sCtx.stroke();
  }
}
