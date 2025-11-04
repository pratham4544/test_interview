// frontend/src/utils/constants.js - Clean Frontend Constants
// Removed: Backend-dependent audio/monitoring configs
// Added: Frontend-only audio/video configurations

export const API_BASE = 'http://localhost:8000';

export const STEPS = {
  SELECT_CANDIDATE: 'select-candidate',
  CONSENT: 'consent',
  INTERVIEW: 'interview',
  COMPLETED: 'completed'
};

export const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  gray: '#6b7280',
  indigo: '#6366f1',
  emerald: '#059669'
};

export const GRADIENTS = {
  main: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  interview: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #581c87 100%)',
  speaking: 'linear-gradient(45deg, #06b6d4, #3b82f6, #8b5cf6)',
  idle: 'linear-gradient(45deg, #374151, #4b5563, #6b7280)',
  recording: 'linear-gradient(45deg, #ef4444, #f97316, #eab308)',
  transcribing: 'linear-gradient(45deg, #8b5cf6, #a855f7, #c084fc)',
  ready: 'linear-gradient(45deg, #059669, #10b981, #34d399)',
  success: 'linear-gradient(45deg, #10b981, #34d399, #6ee7b7)',
  warning: 'linear-gradient(45deg, #f59e0b, #fbbf24, #fcd34d)'
};

// =========================
// FRONTEND AUDIO CONFIGURATION
// =========================

export const AUDIO_CONFIG = {
  // Web Audio API settings
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  
  // Recording settings
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
  
  // Fallback settings
  fallbackMimeTypes: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/wav'
  ]
};

// =========================
// FRONTEND SPEECH RECOGNITION
// =========================

export const SPEECH_CONFIG = {
  // Web Speech API settings
  continuous: true,
  interimResults: true,
  lang: 'en-US',
  maxAlternatives: 1,
  
  // Voice Activity Detection
  silenceThreshold: 0.01,        // Volume threshold for silence
  silenceDuration: 2000,         // ms of silence before stopping
  maxRecordingTime: 120000,      // Maximum recording time (2 minutes)
  volumeCheckInterval: 100,      // Check volume every 100ms
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,             // ms between retries
  
  // Browser compatibility
  webkitSpeechRecognition: window.webkitSpeechRecognition || window.SpeechRecognition,
  isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
};

// =========================
// FRONTEND SCREEN CAPTURE
// =========================

export const SCREEN_CAPTURE_CONFIG = {
  // Screen Capture API settings
  video: {
    mediaSource: 'screen',
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 5, max: 10 }  // Lower framerate for monitoring
  },
  audio: false,  // Usually not needed for monitoring
  
  // Capture intervals
  screenshotInterval: 30000,      // Take screenshot every 30 seconds
  randomInterval: {
    min: 15000,                   // Minimum 15 seconds
    max: 45000                    // Maximum 45 seconds
  },
  
  // Image settings
  imageFormat: 'image/jpeg',
  imageQuality: 0.7,              // 70% quality for smaller file size
  
  // Browser compatibility
  isSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
};

// =========================
// INTERVIEW CONFIGURATION
// =========================

export const INTERVIEW_CONFIG = {
  // Timing
  greetingDelay: 1000,           // Delay before greeting
  questionDelay: 1000,           // Delay before each question
  feedbackDelay: 2000,           // Delay before showing feedback
  autoProgressDelay: 3000,       // Auto-progress to next question
  
  // Question settings
  maxQuestions: 10,
  defaultQuestions: 5,
  timePerQuestion: 300,          // 5 minutes per question
  
  // Auto-submission
  autoSubmitDelay: 5000,         // Auto-submit after 5 seconds of silence
  confirmAutoSubmit: true        // Ask for confirmation before auto-submit
};

export const FOLLOW_UP_CONFIG = {
  maxLevel: 2,                   // Maximum follow-up levels
  requiredScore: 7,              // Score threshold for follow-up
  genericQuestion: "Can you provide a more specific example or elaborate further on your approach?",
  followUpDelay: 2000           // Delay before follow-up question
};

// =========================
// TTS CONFIGURATION
// =========================

export const TTS_CONFIG = {
  defaultLanguage: 'en',
  defaultSlow: false,
  fallbackEnabled: true,
  serverFirst: true,             // Try server TTS first, then Web Speech API
  
  // Web Speech API TTS (fallback)
  webSpeechTTS: {
    rate: 0.9,                   // Speaking rate
    pitch: 1.0,                  // Voice pitch
    volume: 0.8,                 // Volume level
    voice: null                  // Will be set to best available voice
  },
  
  // Audio management
  stopOnNewRequest: true,        // Stop current audio when new request comes
  fadeInDuration: 200,           // Fade in time for audio
  fadeOutDuration: 200           // Fade out time for audio
};

// =========================
// UI CONFIGURATION
// =========================

export const UI_CONFIG = {
  participantCircleSize: 200,
  animationDuration: 300,
  debounceMs: 500,
  maxRetries: 3,
  
  // Responsive breakpoints
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1280
  },
  
  // Theme settings
  darkMode: false,
  fontSize: 'medium',            // small, medium, large
  reducedMotion: false
};

// =========================
// STATE MANAGEMENT
// =========================

export const VOICE_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error'
};

export const INTERVIEW_STATES = {
  NOT_STARTED: 'not_started',
  CONSENT: 'consent',
  SETUP: 'setup',
  IN_PROGRESS: 'in_progress',
  FOLLOW_UP: 'follow_up',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const RECORDING_STATES = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RECORDING: 'recording',
  STOPPING: 'stopping',
  PROCESSING: 'processing'
};

export const SCREEN_STATES = {
  INACTIVE: 'inactive',
  REQUESTING: 'requesting',
  ACTIVE: 'active',
  ERROR: 'error'
};

// =========================
// RESPONSE TYPES
// =========================

export const RESPONSE_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

export const SCORE_THRESHOLDS = {
  EXCELLENT: 8,
  GOOD: 6,
  NEEDS_IMPROVEMENT: 4,
  POOR: 0
};

// =========================
// ERROR MESSAGES
// =========================

export const ERROR_MESSAGES = {
  // Microphone errors
  MICROPHONE_DENIED: 'Microphone access denied. Please enable microphone permissions in your browser.',
  MICROPHONE_NOT_FOUND: 'No microphone found. Please connect a microphone and try again.',
  MICROPHONE_BUSY: 'Microphone is being used by another application.',
  
  // Audio errors
  AUDIO_NOT_SUPPORTED: 'Audio recording is not supported in this browser. Please use Chrome, Firefox, or Safari.',
  AUDIO_RECORDING_FAILED: 'Audio recording failed. Please check your microphone and try again.',
  AUDIO_PLAYBACK_FAILED: 'Audio playback failed. Please check your speakers and try again.',
  
  // Speech recognition errors
  SPEECH_NOT_SUPPORTED: 'Speech recognition is not supported in this browser.',
  SPEECH_RECOGNITION_FAILED: 'Speech recognition failed. Please try speaking again.',
  SPEECH_NO_INPUT: 'No speech detected. Please try speaking clearly.',
  SPEECH_NETWORK_ERROR: 'Speech recognition network error. Please check your connection.',
  
  // Screen capture errors
  SCREEN_CAPTURE_DENIED: 'Screen capture permission denied. This is required for interview monitoring.',
  SCREEN_CAPTURE_NOT_SUPPORTED: 'Screen capture is not supported in this browser.',
  SCREEN_CAPTURE_FAILED: 'Screen capture failed. Please try again.',
  
  // Network errors
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  
  // Interview errors
  INVALID_CANDIDATE: 'Invalid candidate ID. Please select a valid candidate.',
  INTERVIEW_SETUP_FAILED: 'Failed to setup interview. Please try again.',
  ANSWER_SUBMISSION_FAILED: 'Failed to submit answer. Please try again.',
  
  // General errors
  UNKNOWN_ERROR: 'An unknown error occurred. Please refresh the page and try again.',
  BROWSER_NOT_SUPPORTED: 'Your browser is not fully supported. Please use the latest version of Chrome, Firefox, or Safari.'
};

// =========================
// SUCCESS MESSAGES
// =========================

export const SUCCESS_MESSAGES = {
  INTERVIEW_STARTED: 'Interview started successfully!',
  ANSWER_SUBMITTED: 'Answer submitted successfully!',
  INTERVIEW_COMPLETED: 'Interview completed successfully!',
  PERMISSIONS_GRANTED: 'Permissions granted successfully!',
  AUDIO_READY: 'Audio system ready!',
  MICROPHONE_READY: 'Microphone ready!',
  SCREEN_CAPTURE_READY: 'Screen monitoring ready!'
};

// =========================
// BROWSER COMPATIBILITY
// =========================

export const BROWSER_SUPPORT = {
  // Check if current browser supports required features
  checkSupport: () => {
    const features = {
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      screenCapture: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      speechSynthesis: !!window.speechSynthesis
    };
    
    const isSupported = Object.values(features).every(supported => supported);
    
    return {
      isSupported,
      features,
      recommendations: !isSupported ? [
        'Use the latest version of Chrome, Firefox, or Safari',
        'Enable microphone and camera permissions',
        'Ensure you have a stable internet connection'
      ] : []
    };
  }
};

// =========================
// LOCAL STORAGE KEYS
// =========================

export const STORAGE_KEYS = {
  CANDIDATE_ID: 'ai_interviewer_candidate_id',
  SESSION_ID: 'ai_interviewer_session_id',
  INTERVIEW_STATE: 'ai_interviewer_state',
  USER_PREFERENCES: 'ai_interviewer_preferences',
  CONSENT_GIVEN: 'ai_interviewer_consent',
  AUDIO_SETTINGS: 'ai_interviewer_audio_settings'
};

// =========================
// EXPORT DEFAULT CONFIG
// =========================

export default {
  API_BASE,
  STEPS,
  COLORS,
  GRADIENTS,
  AUDIO_CONFIG,
  SPEECH_CONFIG,
  SCREEN_CAPTURE_CONFIG,
  INTERVIEW_CONFIG,
  FOLLOW_UP_CONFIG,
  TTS_CONFIG,
  UI_CONFIG,
  VOICE_STATES,
  INTERVIEW_STATES,
  RECORDING_STATES,
  SCREEN_STATES,
  RESPONSE_TYPES,
  SCORE_THRESHOLDS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  BROWSER_SUPPORT,
  STORAGE_KEYS
};