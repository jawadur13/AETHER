// Aether Constellation Space-Star Mixer

export class Constellation {
  constructor(canvas, audioEngine, onNodeDoubleClicked) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = audioEngine;
    this.onNodeDoubleClicked = onNodeDoubleClicked;
    
    this.selectedNode = null;
    this.hoveredNode = null;
    this.isDragging = false;
    
    // Core parameters (Center)
    this.coreX = 0.5; // relative coords (0-1)
    this.coreY = 0.5;
    
    // Mouse coords
    this.mouseX = 0;
    this.mouseY = 0;
    
    // Setup dimensions and hooks
    this.resize();
    window.addEventListener("resize", () => this.resize());
    
    this.setupEventListeners();
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Recalculate node positions in the audio engine to match space boundaries
    this.updateAudioMixing();
  }

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseup", () => this.handleMouseUp());
    this.canvas.addEventListener("mouseleave", () => this.handleMouseUp());
    this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
    
    // Touch support for mobiles
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleMouseDown(touch);
    }, { passive: false });
    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleMouseMove(touch);
    }, { passive: false });
    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.handleMouseUp();
    }, { passive: false });
  }

  // Translate client mouse coordinates to canvas relative percentages
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  }

  findNodeAt(pos) {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    // Hit radius 25px
    const hitRadius = 30;
    
    for (const node of this.audio.nodes) {
      const nx = node.x * w;
      const ny = node.y * h;
      const mx = pos.x * w;
      const my = pos.y * h;
      
      const dist = Math.sqrt((nx - mx) ** 2 + (ny - my) ** 2);
      if (dist < hitRadius) {
        return node;
      }
    }
    return null;
  }

  handleMouseDown(e) {
    const pos = this.getMousePos(e);
    const node = this.findNodeAt(pos);
    
    if (node) {
      this.selectedNode = node;
      this.isDragging = true;
      
      // Auto-start node audio on click/grab if context is active
      if (this.audio.initialized && this.audio.isPlaying && !node.active && !node.mute) {
        this.audio.fadeInNode(node);
      }
    }
  }

  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    this.mouseX = pos.x * w;
    this.mouseY = pos.y * h;
    
    if (this.isDragging && this.selectedNode) {
      // Clamp coordinates to stay slightly within screen edges (0.05 to 0.95)
      this.selectedNode.x = Math.max(0.05, Math.min(0.95, pos.x));
      this.selectedNode.y = Math.max(0.05, Math.min(0.95, pos.y));
      
      this.updateAudioMixing();
    } else {
      // Handle hover states
      this.hoveredNode = this.findNodeAt(pos);
      this.canvas.style.cursor = this.hoveredNode ? "pointer" : "default";
    }
  }

  handleMouseUp() {
    this.selectedNode = null;
    this.isDragging = false;
  }

  handleDoubleClick(e) {
    const pos = this.getMousePos(e);
    const node = this.findNodeAt(pos);
    if (node && this.onNodeDoubleClicked) {
      this.onNodeDoubleClicked(node);
    }
  }

  // Re-calculate spatial parameters based on core distances
  updateAudioMixing() {
    this.audio.nodes.forEach(node => {
      // Calculate Euclidean distance to core center (0.5, 0.5)
      const dx = node.x - this.coreX;
      // Competing for aspect ratio skew
      const dy = node.y - this.coreY;
      
      // Max possible distance is from center to corner (sqrt(0.5^2 + 0.5^2) ≈ 0.707)
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 0.55; // Slightly shorter than corner for full fadeout at bounds
      const distPercent = Math.min(1.0, dist / maxDist);
      
      this.audio.updateSpatialMixing(node.id, distPercent);
    });
  }

  animate() {
    this.updateNodesDrift();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  // Introduce slow drift so space elements move gracefully
  updateNodesDrift() {
    if (this.isDragging) return;
    
    const time = Date.now() * 0.0003;
    
    this.audio.nodes.forEach((node, i) => {
      // Do not drift the node currently selected
      if (this.selectedNode && this.selectedNode.id === node.id) return;
      
      // Compute periodic orbital offsets
      const driftX = Math.sin(time + i * 1.5) * 0.0003;
      const driftY = Math.cos(time + i * 2.2) * 0.0003;
      
      node.x = Math.max(0.05, Math.min(0.95, node.x + driftX));
      node.y = Math.max(0.05, Math.min(0.95, node.y + driftY));
    });
    
    this.updateAudioMixing();
  }

  draw() {
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    this.ctx.clearRect(0, 0, w, h);
    
    const cx = this.coreX * w;
    const cy = this.coreY * h;
    
    // 1. Draw central Core "Aether Receptor"
    this.drawCore(cx, cy);
    
    // 2. Draw connection constellation lines and stars
    this.audio.nodes.forEach(node => {
      const nx = node.x * w;
      const ny = node.y * h;
      
      // Check node distance for line intensity
      const dx = node.x - this.coreX;
      const dy = node.y - this.coreY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const intensity = Math.max(0.05, 1 - (dist / 0.55));
      
      // Draw line
      this.ctx.beginPath();
      this.ctx.strokeStyle = node.mute 
        ? `rgba(75, 85, 99, 0.1)` 
        : `rgba(6, 182, 212, ${0.1 + intensity * 0.45})`;
      this.ctx.lineWidth = node.mute ? 1 : 1.5 + intensity * 2;
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(nx, ny);
      this.ctx.stroke();
      
      // Draw Star Node
      this.drawNode(node, nx, ny, intensity);
    });

    // 3. Draw text tip if hovering
    if (this.hoveredNode) {
      this.drawTooltip(this.hoveredNode, w, h);
    }
  }

  drawCore(cx, cy) {
    const pulseFactor = 1 + Math.sin(Date.now() * 0.003) * 0.08;
    const baseRad = 20;
    const rad = baseRad * pulseFactor;
    
    // Outer pulse ring
    this.ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, rad * 2, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Core glow gradient
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.3, "rgba(124, 58, 237, 0.8)");
    grad.addColorStop(1, "rgba(6, 182, 212, 0)");
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Label Core
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.font = "9px 'Share Tech Mono'";
    this.ctx.textAlign = "center";
    this.ctx.fillText("CORE", cx, cy - 25);
  }

  drawNode(node, nx, ny, intensity) {
    const pulseFactor = 1 + Math.sin(Date.now() * 0.005 + node.id * 1.5) * 0.12;
    const isPlaying = node.active && !node.mute && this.audio.isPlaying;
    const rad = (isPlaying ? 12 : 8) * pulseFactor;
    
    // Star glow shadows
    this.ctx.shadowBlur = isPlaying ? 15 + intensity * 20 : 5;
    this.ctx.shadowColor = node.mute ? "rgba(75, 85, 99, 0.2)" : node.color;
    
    // Outer resonance boundary rings
    if (isPlaying) {
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + intensity * 0.25})`;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, rad * 2.2, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Core body
    const grad = this.ctx.createRadialGradient(nx, ny, 0, nx, ny, rad);
    if (node.mute) {
      grad.addColorStop(0, "rgba(156, 163, 175, 0.8)");
      grad.addColorStop(1, "rgba(75, 85, 99, 0.1)");
    } else {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.3, node.color);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    }
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(nx, ny, rad, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Reset shadow blur
    this.ctx.shadowBlur = 0;
    
    // Node tiny badge labels
    this.ctx.fillStyle = isPlaying ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
    this.ctx.font = "10px 'Space Grotesk'";
    this.ctx.textAlign = "center";
    this.ctx.fillText(node.name, nx, ny + rad + 14);
  }

  drawTooltip(node, w, h) {
    const nx = node.x * w;
    const ny = node.y * h;
    
    // Calculate distance
    const dx = node.x - this.coreX;
    const dy = node.y - this.coreY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const vol = Math.max(0, 100 - Math.round((dist / 0.55) * 100));
    
    const tipText = `Vol: ${node.mute ? "Muted" : vol + "%"} | Type: ${node.type.toUpperCase()}`;
    this.ctx.font = "9px 'Share Tech Mono'";
    const tipWidth = this.ctx.measureText(tipText).width + 20;
    
    this.ctx.fillStyle = "rgba(4, 2, 9, 0.85)";
    this.ctx.strokeStyle = "rgba(124, 58, 237, 0.4)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(nx - tipWidth/2, ny - 45, tipWidth, 20, 4);
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.fillStyle = "rgba(6, 182, 212, 0.9)";
    this.ctx.font = "9px 'Share Tech Mono'";
    this.ctx.textAlign = "center";
    this.ctx.fillText(tipText, nx, ny - 32);
  }
}
