// frontend/src/services/audioService.js - Frontend-Only Audio Service
// Uses Web Audio API, Web Speech API, and Screen Capture API
// No backend dependencies for audio/video functionality

import { AUDIO_CONFIG, SPEECH_CONFIG, SCREEN_CAPTURE_CONFIG, ERROR_MESSAGES } from '../utils/constants';

class AudioService {
  constructor() {
    // Audio recording state
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingPromise = null;
    
    // Speech recognition state
    this.speechRecognition = null;
    this.isListening = false;
    this.speechPromise = null;
    
    // Audio playback state
    this.currentAudio = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    // Screen capture state
    this.screenStream = null;
    this.screenRecorder = null;
    this.isScreenCapturing = false;
    
    // Volume analysis
    this.audioContext = null;
    this.analyser = null;
    this.volumeCheckInterval = null;
    
    // Initialize speech recognition if supported
    this.initializeSpeechRecognition();
  }

  // =========================
  // INITIALIZATION
  // =========================

  async initialize() {
    try {
      // Check browser support
      const support = this.checkBrowserSupport();
      if (!support.isSupported) {
        throw new Error(`Browser not supported: ${support.missing.join(', ')}`);
      }

      // Initialize audio context
      await this.initializeAudioContext();
      
      console.log('✅ Audio service initialized successfully');
      return { success: true, support };
    } catch (error) {
      console.error('❌ Audio service initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  checkBrowserSupport() {
    const features = {
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      screenCapture: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      speechSynthesis: !!window.speechSynthesis
    };

    const missing = Object.entries(features)
      .filter(([, supported]) => !supported)
      .map(([feature]) => feature);

    return {
      isSupported: missing.length === 0,
      features,
      missing
    };
  }

  async initializeAudioContext() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Resume context if it's suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
  }

  initializeSpeechRecognition() {
    if (SPEECH_CONFIG.isSupported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      
      // Configure speech recognition
      this.speechRecognition.continuous = SPEECH_CONFIG.continuous;
      this.speechRecognition.interimResults = SPEECH_CONFIG.interimResults;
      this.speechRecognition.lang = SPEECH_CONFIG.lang;
      this.speechRecognition.maxAlternatives = SPEECH_CONFIG.maxAlternatives;
    }
  }

  // =========================
  // MICROPHONE PERMISSIONS
  // =========================

  async checkMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (error) {
      console.error('Microphone permission check failed:', error);
      return { 
        granted: false, 
        error: error.name === 'NotAllowedError' ? ERROR_MESSAGES.MICROPHONE_DENIED : error.message 
      };
    }
  }

  async requestMicrophonePermission() {
    return this.checkMicrophonePermission();
  }

  // =========================
  // AUDIO RECORDING
  // =========================

  async startRecording() {
    try {
      if (this.isRecording) {
        throw new Error('Already recording');
      }

      // Stop any playing audio
      this.stopCurrentAudio();

      // Get audio stream
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: AUDIO_CONFIG 
      });

      // Setup media recorder
      const mimeType = this.getBestMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, { 
        mimeType,
        audioBitsPerSecond: AUDIO_CONFIG.audioBitsPerSecond
      });

      this.audioChunks = [];
      this.isRecording = true;

      // Setup volume analysis
      this.setupVolumeAnalysis();

      // Create recording promise
      this.recordingPromise = new Promise((resolve, reject) => {
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          this.cleanup();
          resolve(audioBlob);
        };

        this.mediaRecorder.onerror = (error) => {
          this.cleanup();
          reject(error);
        };
      });

      this.mediaRecorder.start();
      console.log('🎙️ Audio recording started');
      
      return this.recordingPromise;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.cleanup();
      throw new Error(ERROR_MESSAGES.AUDIO_RECORDING_FAILED);
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder) {
        return null;
      }

      this.mediaRecorder.stop();
      this.stopVolumeAnalysis();
      
      const audioBlob = await this.recordingPromise;
      console.log('⏹️ Audio recording stopped');
      
      return audioBlob;
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.cleanup();
      throw error;
    }
  }

  getBestMimeType() {
    for (const mimeType of AUDIO_CONFIG.fallbackMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`✅ Using MIME type: ${mimeType}`);
        return mimeType;
      }
    }
    console.warn('⚠️ No supported MIME type found, using default');
    return 'audio/webm';
  }

  // =========================
  // SPEECH RECOGNITION
  // =========================

  async startSpeechRecognition() {
    try {
      if (!SPEECH_CONFIG.isSupported) {
        throw new Error(ERROR_MESSAGES.SPEECH_NOT_SUPPORTED);
      }

      if (this.isListening) {
        this.speechRecognition.stop();
      }

      this.isListening = true;

      this.speechPromise = new Promise((resolve, reject) => {
        let finalTranscript = '';
        let timeoutId = null;

        // Reset timeout on speech input
        const resetTimeout = () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            this.speechRecognition.stop();
          }, SPEECH_CONFIG.maxRecordingTime);
        };

        this.speechRecognition.onresult = (event) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Reset timeout when we get speech
          if (finalTranscript || interimTranscript) {
            resetTimeout();
          }

          // Emit interim results
          this.onInterimResult?.(interimTranscript);
        };

        this.speechRecognition.onend = () => {
          this.isListening = false;
          if (timeoutId) clearTimeout(timeoutId);
          
          if (finalTranscript.trim()) {
            resolve(finalTranscript.trim());
          } else {
            reject(new Error(ERROR_MESSAGES.SPEECH_NO_INPUT));
          }
        };

        this.speechRecognition.onerror = (event) => {
          this.isListening = false;
          if (timeoutId) clearTimeout(timeoutId);
          
          console.error('Speech recognition error:', event.error);
          
          switch (event.error) {
            case 'network':
              reject(new Error(ERROR_MESSAGES.SPEECH_NETWORK_ERROR));
              break;
            case 'not-allowed':
              reject(new Error(ERROR_MESSAGES.MICROPHONE_DENIED));
              break;
            default:
              reject(new Error(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED));
          }
        };

        this.speechRecognition.onstart = () => {
          console.log('🎯 Speech recognition started');
          resetTimeout();
        };

        resetTimeout();
      });

      this.speechRecognition.start();
      return this.speechPromise;
    } catch (error) {
      console.error('❌ Speech recognition failed:', error);
      this.isListening = false;
      throw error;
    }
  }

  stopSpeechRecognition() {
    if (this.speechRecognition && this.isListening) {
      this.speechRecognition.stop();
    }
  }

  // =========================
  // AUDIO PLAYBACK
  // =========================

  async playAudioFromBase64(base64Audio) {
    try {
      const audio = await this.createAudioFromBase64(base64Audio);
      return this.playAudio(audio);
    } catch (error) {
      console.error('❌ Audio playback failed:', error);
      throw new Error(ERROR_MESSAGES.AUDIO_PLAYBACK_FAILED);
    }
  }

  createAudioFromBase64(base64Audio) {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          resolve(audio);
        };
        
        const handleError = (event) => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          reject(new Error('Failed to load audio'));
        };
        
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        audio.load();
      } catch (error) {
        reject(error);
      }
    });
  }

  playAudio(audio) {
    return new Promise((resolve, reject) => {
      this.stopCurrentAudio();
      this.currentAudio = audio;
      this.isPlayingAudio = true;

      audio.onended = () => {
        this.isPlayingAudio = false;
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        this.isPlayingAudio = false;
        this.currentAudio = null;
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch(reject);
    });
  }

  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isPlayingAudio = false;
    }
  }

  // =========================
  // SCREEN CAPTURE
  // =========================

  async startScreenCapture() {
    try {
      if (!SCREEN_CAPTURE_CONFIG.isSupported) {
        throw new Error(ERROR_MESSAGES.SCREEN_CAPTURE_NOT_SUPPORTED);
      }

      this.screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CAPTURE_CONFIG);
      this.isScreenCapturing = true;

      // Handle stream end (user stops sharing)
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenCapture();
      };

      console.log('📺 Screen capture started');
      return this.screenStream;
    } catch (error) {
      console.error('❌ Screen capture failed:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error(ERROR_MESSAGES.SCREEN_CAPTURE_DENIED);
      } else {
        throw new Error(ERROR_MESSAGES.SCREEN_CAPTURE_FAILED);
      }
    }
  }

  stopScreenCapture() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.isScreenCapturing = false;
      console.log('📺 Screen capture stopped');
    }
  }

  async takeScreenshot() {
    try {
      if (!this.screenStream) {
        throw new Error('Screen capture not active');
      }

      const video = document.createElement('video');
      video.srcObject = this.screenStream;
      video.play();

      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      return new Promise(resolve => {
        canvas.toBlob(resolve, SCREEN_CAPTURE_CONFIG.imageFormat, SCREEN_CAPTURE_CONFIG.imageQuality);
      });
    } catch (error) {
      console.error('❌ Screenshot failed:', error);
      throw error;
    }
  }

  // =========================
  // VOLUME ANALYSIS
  // =========================

  setupVolumeAnalysis() {
    if (!this.audioStream || !this.audioContext) return;

    try {
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.volumeCheckInterval = setInterval(() => {
        this.analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / bufferLength / 255;
        this.onVolumeChange?.(volume);
      }, SPEECH_CONFIG.volumeCheckInterval);
    } catch (error) {
      console.error('❌ Volume analysis setup failed:', error);
    }
  }

  stopVolumeAnalysis() {
    if (this.volumeCheckInterval) {
      clearInterval(this.volumeCheckInterval);
      this.volumeCheckInterval = null;
    }
    this.analyser = null;
  }

  // =========================
  // UTILITY METHODS
  // =========================

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  cleanup() {
    // Stop all streams
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Reset recording state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingPromise = null;

    // Stop volume analysis
    this.stopVolumeAnalysis();

    // Stop audio playback
    this.stopCurrentAudio();

    // Stop speech recognition
    this.stopSpeechRecognition();

    // Stop screen capture
    this.stopScreenCapture();
  }

  // =========================
  // EVENT HANDLERS (can be overridden)
  // =========================

  onVolumeChange = null;          // (volume) => {}
  onInterimResult = null;         // (interimText) => {}
  onRecordingStart = null;        // () => {}
  onRecordingStop = null;         // () => {}
  onSpeechStart = null;           // () => {}
  onSpeechEnd = null;             // (finalText) => {}

  // =========================
  // STATE GETTERS
  // =========================

  getState() {
    return {
      isRecording: this.isRecording,
      isListening: this.isListening,
      isPlayingAudio: this.isPlayingAudio,
      isScreenCapturing: this.isScreenCapturing,
      browserSupport: this.checkBrowserSupport()
    };
  }
}

// Create and export singleton instance
const audioService = new AudioService();
export default audioService;