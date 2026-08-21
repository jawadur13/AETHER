// Aether Morse Code Translator & Playback Engine

const MORSE_MAP = {
  'A': '.-',     'B': '-...',   'C': '-.-.',   'D': '-..',    'E': '.',
  'F': '..-.',   'G': '--.',    'H': '....',   'I': '..',     'J': '.---',
  'K': '-.-',    'L': '.-..',   'M': '--',     'N': '-.',     'O': '---',
  'P': '.--.',   'Q': '--.-',   'R': '.-.',    'S': '...',    'T': '-',
  'U': '..-',    'V': '...-',   'W': '.--',    'X': '-..-',   'Y': '-.--',
  'Z': '--..',   '1': '.----',  '2': '..---',  '3': '...--',  '4': '....-',
  '5': '.....',  '6': '-....',  '7': '--...',  '8': '---..',  '9': '----.',
  '0': '-----',  ' ': '/'
};

export class MorseEngine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    
    // Playback state
    this.isPlaying = false;
    this.currentTimeout = null;
    this.currentSequence = [];
    this.sequenceIndex = 0;
  }

  translate(text) {
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    return cleanText.split('').map(char => {
      return {
        char: char,
        code: MORSE_MAP[char] || ''
      };
    });
  }

  // Parse text into a list of timed steps (on/off events)
  buildSequence(translated, wpm) {
    // Standard WPM formula: dot duration = 1200 / WPM (milliseconds)
    const dotDuration = 1200 / wpm;
    const dashDuration = dotDuration * 3;
    const symbolSpace = dotDuration;       // space between dots/dashes within char
    const charSpace = dotDuration * 3;       // space between characters
    const wordSpace = dotDuration * 7;       // space between words

    const seq = [];

    translated.forEach((item, itemIdx) => {
      const isLastItem = itemIdx === translated.length - 1;
      
      if (item.char === ' ') {
        seq.push({ type: 'OFF', duration: wordSpace, label: ' ' });
        return;
      }
      
      // Push character marker
      seq.push({ type: 'CHAR', label: item.char, code: item.code });

      const symbols = item.code.split('');
      symbols.forEach((symbol, symIdx) => {
        const isLastSymbol = symIdx === symbols.length - 1;
        const duration = symbol === '.' ? dotDuration : dashDuration;
        
        // Tone ON
        seq.push({ type: 'ON', duration: duration });
        
        // Tone OFF spacing
        if (!isLastSymbol) {
          seq.push({ type: 'OFF', duration: symbolSpace });
        }
      });
      
      // Spacing between letters
      if (!isLastItem && translated[itemIdx + 1].char !== ' ') {
        seq.push({ type: 'OFF', duration: charSpace });
      }
    });

    return seq;
  }

  play(text, wpm, pitchHz, onTick, onComplete) {
    this.stop(); // Clear any ongoing playback
    
    const translated = this.translate(text);
    if (translated.length === 0) return;
    
    this.currentSequence = this.buildSequence(translated, wpm);
    this.sequenceIndex = 0;
    this.isPlaying = true;
    
    // Start Audio Morse Synth Channel
    this.audio.startMorseTransmission(pitchHz);
    
    const nextStep = () => {
      if (!this.isPlaying) return;
      
      if (this.sequenceIndex >= this.currentSequence.length) {
        this.stop();
        if (onComplete) onComplete();
        return;
      }
      
      const step = this.currentSequence[this.sequenceIndex];
      this.sequenceIndex++;
      
      if (step.type === 'ON') {
        this.audio.triggerMorseKey(true);
        if (onTick) onTick({ type: 'KEY_DOWN' });
      } else if (step.type === 'OFF') {
        this.audio.triggerMorseKey(false);
        if (onTick) onTick({ type: 'KEY_UP' });
      } else if (step.type === 'CHAR') {
        if (onTick) onTick({ type: 'CHAR', char: step.label, code: step.code });
      }
      
      // Schedule next sequence step
      const stepDuration = step.duration || 0;
      if (stepDuration > 0) {
        this.currentTimeout = setTimeout(nextStep, stepDuration);
      } else {
        nextStep(); // Advance immediately for markers like CHAR
      }
    };
    
    nextStep();
  }

  // Live pitch adjustment while a transmission is running
  updatePitch(pitchHz) {
    const synth = this.audio.morseSynth;
    if (synth && synth.isActive && synth.osc && this.audio.initialized) {
      synth.osc.frequency.setTargetAtTime(pitchHz, this.audio.ctx.currentTime, 0.02);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    // Halt Audio
    this.audio.triggerMorseKey(false);
    this.audio.stopMorseTransmission();
  }
}
