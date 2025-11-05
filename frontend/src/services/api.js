// frontend/src/services/api.js - Clean API Service
// Removed: Speech recognition, monitoring, audio recording endpoints
// Frontend now handles all audio/video functionality

// const API_BASE = process.env.REACT_APP_API_BASE || 'http://ai-interviewer-v1.duckdns.org' || 'http://localhost:8000';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
  }

  // =========================
  // CORE API METHODS
  // =========================

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Success: ${endpoint}`, { status: response.status });
      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // =========================
  // CANDIDATE MANAGEMENT
  // =========================

  async fetchCandidates() {
    return this.makeRequest('/candidates');
  }

  async getCandidate(candidateId) {
    return this.makeRequest(`/candidate/${candidateId}`);
  }

  // =========================
  // INTERVIEW MANAGEMENT
  // =========================

  async setupInterview(candidateId) {
    return this.makeRequest('/interview/setup', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId })
    });
  }

  async submitAnswer(candidateId, questionIndex, question, answer) {
    return this.makeRequest('/answer/submit', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        question_index: questionIndex,
        question: question,
        answer: answer
      })
    });
  }

  async submitFollowUpAnswer(candidateId, originalQuestion, originalAnswer, followUpQuestion, followUpAnswer, followUpLevel) {
    return this.makeRequest('/answer/follow-up', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        original_question: originalQuestion,
        original_answer: originalAnswer,
        follow_up_question: followUpQuestion,
        follow_up_answer: followUpAnswer,
        follow_up_level: followUpLevel
      })
    });
  }

  async completeInterview(candidateId, sessionId, interactions, voiceRecordings = [], screenshots = []) {
    // Note: voiceRecordings and screenshots are now handled by frontend
    // They can be stored locally or sent as base64 if needed
    return this.makeRequest('/interview/complete-and-save', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        session_id: sessionId,
        interactions: interactions,
        // Frontend can add metadata about recordings/screenshots
        metadata: {
          voice_recordings_count: voiceRecordings.length,
          screenshots_count: screenshots.length,
          recording_method: 'frontend',
          browser_info: navigator.userAgent
        }
      })
    });
  }

  async getCandidateScore(candidateId) {
    return this.makeRequest(`/candidate/${candidateId}/score`);
  }

  async deleteInterviewData(candidateId) {
    return this.makeRequest(`/interview/${candidateId}`, {
      method: 'DELETE'
    });
  }

  // =========================
  // TEXT-TO-SPEECH (Pre-generated only)
  // =========================

  async getTextToSpeech(text, candidateId = null, language = 'en', slow = false) {
    try {
      const requestBody = {
        text: text,
        language: language,
        slow: slow
      };

      // Include candidate_id if available for pre-generated audio
      if (candidateId) {
        requestBody.candidate_id = candidateId;
      }

      console.log('🎵 Requesting TTS:', { 
        text: text.substring(0, 50) + '...', 
        candidateId, 
        source: candidateId ? 'pre-generated' : 'fallback' 
      });

      const response = await fetch(`${API_BASE}/tts/speak-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ TTS Response error:', errorText);
        throw new Error('TTS request failed');
      }
      
      const result = await response.json();
      console.log('✅ TTS Response received:', { 
        success: result.success, 
        source: result.source || 'unknown',
        format: result.format 
      });
      
      return result;
    } catch (error) {
      console.error('TTS error:', error);
      throw error;
    }
  }

  async getTTSFile(candidateId, questionNumber) {
    const url = `${API_BASE}/tts/speak/${candidateId}/${questionNumber}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch TTS file: ${response.status}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('TTS File error:', error);
      throw error;
    }
  }

  // =========================
  // CODING ROUND (if needed)
  // =========================

  async submitCode(candidateId, code) {
    return this.makeRequest('/coding/submit', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        code: code
      })
    });
  }

  // =========================
  // REPORTS
  // =========================

  async getCandidateReport(candidateId) {
    const url = `${API_BASE}/report/${candidateId}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('Report fetch error:', error);
      throw error;
    }
  }

  // =========================
  // PREPROCESSING
  // =========================

  async storeQuestions(candidateId, questions) {
    return this.makeRequest('/store-questions', {
      method: 'POST',
      body: JSON.stringify({
        candidate_id: candidateId,
        questions: questions
      })
    });
  }

  // =========================
  // SYSTEM HEALTH
  // =========================

  async getHealthStatus() {
    return this.makeRequest('/health');
  }

  async getSystemInfo() {
    return this.makeRequest('/');
  }

  // =========================
  // UTILITY METHODS
  // =========================

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
        
        // Start loading the audio
        audio.load();
      } catch (error) {
        reject(error);
      }
    });
  }

  async playTTSAudio(base64Audio) {
    try {
      const audio = await this.createAudioFromBase64(base64Audio);
      
      return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('TTS playback error:', error);
      throw error;
    }
  }

  // =========================
  // ERROR HANDLING
  // =========================

  handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    if (error.message.includes('404')) {
      return { error: 'Resource not found', code: 404 };
    } else if (error.message.includes('400')) {
      return { error: 'Bad request', code: 400 };
    } else if (error.message.includes('500')) {
      return { error: 'Server error', code: 500 };
    } else {
      return { error: 'Network error', code: 0 };
    }
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;
