// frontend/src/hooks/useInterview.js - Complete Interview Management Hook
// Fixed: Function declaration order, proper export, and enhanced submission handling

import { useState, useCallback, useRef, useEffect } from 'react';
import apiService from '../services/api';
import audioService from '../services/audioService';
import { 
  INTERVIEW_STATES, 
  FOLLOW_UP_CONFIG, 
  INTERVIEW_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STORAGE_KEYS
} from '../utils/constants';

const useInterview = () => {
  // Core interview state
  const [candidateId, setCandidateId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [interviewState, setInterviewState] = useState(INTERVIEW_STATES.NOT_STARTED);
  const [interviewSetup, setInterviewSetup] = useState(null);
  
  // Question management
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answer, setAnswer] = useState('');
  const [questions, setQuestions] = useState([]);
  const [interactions, setInteractions] = useState([]);
  
  // Feedback and scoring
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [followUpLevel, setFollowUpLevel] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Audio/Video state (frontend-managed)
  const [voiceRecordings, setVoiceRecordings] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  // Refs for cleanup
  const screenshotInterval = useRef(null);
  const sessionData = useRef({});

  // =========================
  // INITIALIZATION
  // =========================

  useEffect(() => {
    // Initialize session data
    if (candidateId) {
      const newSessionId = sessionId || generateSessionId();
      setSessionId(newSessionId);
      
      sessionData.current = {
        candidateId,
        sessionId: newSessionId,
        startTime: new Date().toISOString(),
        interactions: [],
        voiceRecordings: [],
        screenshots: []
      };

      // Save to localStorage for persistence
      localStorage.setItem(STORAGE_KEYS.CANDIDATE_ID, candidateId);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId);
    }
  }, [candidateId, sessionId]);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // =========================
  // INTERVIEW SETUP
  // =========================

  const setupInterview = useCallback(async (candidateId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Setup interview via API
      const data = await apiService.setupInterview(candidateId);
      
      setInterviewSetup(data);
      setQuestions(data.questions || []);
      setCandidateId(candidateId);
      setInterviewState(INTERVIEW_STATES.SETUP);
      
      console.log('✅ Interview setup completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Interview setup failed:', error);
      setError(ERROR_MESSAGES.INTERVIEW_SETUP_FAILED);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================
  // AUDIO/VIDEO MANAGEMENT
  // =========================

  const initializeAudioVideo = useCallback(async () => {
    try {
      if (isAudioEnabled) {
        // Initialize audio service
        const audioResult = await audioService.initialize();
        if (!audioResult.success) {
          console.warn('Audio initialization failed:', audioResult.error);
          setIsAudioEnabled(false);
        }
      }

      if (isVideoEnabled) {
        // Initialize screen capture
        try {
          await audioService.startScreenCapture();
          startScreenshotCapture();
        } catch (error) {
          console.warn('Screen capture initialization failed:', error);
          setIsVideoEnabled(false);
        }
      }

      return { audio: isAudioEnabled, video: isVideoEnabled };
    } catch (error) {
      console.error('Audio/Video initialization failed:', error);
      return { audio: false, video: false };
    }
  }, [isAudioEnabled, isVideoEnabled]);

  const startScreenshotCapture = useCallback(() => {
    if (screenshotInterval.current) {
      clearInterval(screenshotInterval.current);
    }

    const captureScreenshot = async () => {
      try {
        const screenshot = await audioService.takeScreenshot();
        const timestamp = new Date().toISOString();
        
        const screenshotData = {
          timestamp,
          blob: screenshot,
          base64: await audioService.blobToBase64(screenshot),
          reason: 'scheduled'
        };

        setScreenshots(prev => [...prev, screenshotData]);
        sessionData.current.screenshots.push(screenshotData);
        
        console.log('📸 Screenshot captured:', timestamp);
      } catch (error) {
        console.error('Screenshot capture failed:', error);
      }
    };

    // Take initial screenshot
    captureScreenshot();

    // Set up interval for periodic screenshots
    screenshotInterval.current = setInterval(captureScreenshot, 30000); // Every 30 seconds
  }, []);

  const recordAnswer = useCallback(async () => {
    try {
      if (!isAudioEnabled) {
        throw new Error(ERROR_MESSAGES.AUDIO_NOT_SUPPORTED);
      }

      // Start recording
      const audioBlob = await audioService.startRecording();
      
      // Convert to base64 for storage
      const base64Audio = await audioService.blobToBase64(audioBlob);
      const timestamp = new Date().toISOString();
      
      const recordingData = {
        questionIndex: currentQuestion,
        timestamp,
        blob: audioBlob,
        base64: base64Audio,
        duration: audioBlob.size // Approximate
      };

      setVoiceRecordings(prev => [...prev, recordingData]);
      sessionData.current.voiceRecordings.push(recordingData);
      
      console.log('🎙️ Voice recording saved:', timestamp);
      return recordingData;
    } catch (error) {
      console.error('Voice recording failed:', error);
      throw error;
    }
  }, [currentQuestion, isAudioEnabled]);

  // =========================
  // INTERVIEW FLOW - FUNCTIONS IN CORRECT ORDER
  // =========================

  const startInterview = useCallback(async () => {
    try {
      setInterviewState(INTERVIEW_STATES.IN_PROGRESS);
      setCurrentQuestion(0);
      setProgress(0);
      
      // Initialize audio/video if enabled
      await initializeAudioVideo();
      
      console.log('🚀 Interview started');
      return { success: true };
    } catch (error) {
      console.error('Failed to start interview:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [initializeAudioVideo]);

  // 🎯 DECLARE nextQuestion FIRST (before it's referenced)
  const nextQuestion = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setAnswer('');
      setScore(null);
      setFeedback([]);
      setShowFollowUp(false);
      setFollowUpQuestion('');
      setFollowUpAnswer('');
      setFollowUpLevel(0);
    } else {
      // Interview completed
      setInterviewState(INTERVIEW_STATES.COMPLETED);
    }
  }, [currentQuestion, questions.length]);

  // ENHANCED: submitAnswer now accepts optional answerText parameter
  const submitAnswer = useCallback(async (answerText = null) => {
    // Use provided answerText or fall back to state
    const finalAnswer = answerText || answer;
    
    console.log('🔄 submitAnswer called with:', {
      answerText,
      stateAnswer: answer,
      finalAnswer,
      finalAnswerLength: finalAnswer.length
    });
    
    if (!finalAnswer.trim() || !interviewSetup) {
      console.log('⚠️ submitAnswer: Empty answer or no setup, returning null');
      return null;
    }

    try {
      setLoading(true);
      
      // Update state if answerText was provided
      if (answerText && answerText !== answer) {
        console.log('🔧 Updating answer state with provided text');
        setAnswer(answerText);
      }
      
      // Submit answer to API
      const result = await apiService.submitAnswer(
        candidateId,
        currentQuestion,
        interviewSetup.questions[currentQuestion],
        finalAnswer
      );
      
      setScore(result.score);
      setFeedback(result.feedback);
      
      // Store interaction data
      const interactionData = {
        question: interviewSetup.questions[currentQuestion],
        answer: finalAnswer,
        score: result.score,
        feedback: result.feedback,
        question_type: 'behavioral',
        question_index: currentQuestion,
        answered_at: new Date().toISOString(),
        // Add frontend-specific metadata
        has_voice_recording: voiceRecordings.some(r => r.questionIndex === currentQuestion),
        recording_method: 'frontend'
      };

      // Check if follow-up is needed
      if (result.needs_followup && result.follow_up_question && followUpLevel < FOLLOW_UP_CONFIG.maxLevel) {
        setFollowUpQuestion(result.follow_up_question);
        setShowFollowUp(true);
        setFollowUpLevel(1);
      } else {
        // No follow-up needed, store interaction
        const newInteractions = [...interactions, interactionData];
        setInteractions(newInteractions);
        sessionData.current.interactions = newInteractions;
      }

      // Update progress
      const newProgress = ((currentQuestion + 1) / interviewSetup.questions.length) * 100;
      setProgress(newProgress);

      console.log('✅ submitAnswer successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Answer submission failed:', error);
      setError(ERROR_MESSAGES.ANSWER_SUBMISSION_FAILED);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [answer, interviewSetup, candidateId, currentQuestion, interactions, followUpLevel, voiceRecordings]);

  // ENHANCED: submitFollowUp now accepts optional followUpAnswerText parameter
  const submitFollowUp = useCallback(async (followUpAnswerText = null) => {
    // Use provided followUpAnswerText or fall back to state
    const finalFollowUpAnswer = followUpAnswerText || followUpAnswer;
    
    console.log('🔄 submitFollowUp called with:', {
      followUpAnswerText,
      stateFollowUpAnswer: followUpAnswer,
      finalFollowUpAnswer,
      finalFollowUpAnswerLength: finalFollowUpAnswer.length
    });
    
    if (!finalFollowUpAnswer.trim()) {
      console.log('⚠️ submitFollowUp: Empty follow-up answer, returning null');
      return null;
    }

    try {
      setLoading(true);
      
      // Update state if followUpAnswerText was provided
      if (followUpAnswerText && followUpAnswerText !== followUpAnswer) {
        console.log('🔧 Updating followUpAnswer state with provided text');
        setFollowUpAnswer(followUpAnswerText);
      }
      
      const result = await apiService.submitFollowUpAnswer(
        candidateId,
        interviewSetup.questions[currentQuestion],
        answer,
        followUpQuestion,
        finalFollowUpAnswer,
        followUpLevel
      );

      // Create complete interaction with follow-up
      const interactionData = {
        question: interviewSetup.questions[currentQuestion],
        answer: answer,
        score: result.score, // Use follow-up score
        feedback: result.feedback,
        question_type: 'behavioral',
        question_index: currentQuestion,
        answered_at: new Date().toISOString(),
        follow_up_1: {
          question: followUpQuestion,
          answer: finalFollowUpAnswer,
          score: result.score,
          feedback: result.feedback
        },
        has_voice_recording: voiceRecordings.some(r => r.questionIndex === currentQuestion),
        recording_method: 'frontend'
      };

      const newInteractions = [...interactions, interactionData];
      setInteractions(newInteractions);
      sessionData.current.interactions = newInteractions;

      // Clear follow-up state
      setShowFollowUp(false);
      setFollowUpQuestion('');
      setFollowUpAnswer('');
      setFollowUpLevel(0);

      console.log('✅ submitFollowUp successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Follow-up submission failed:', error);
      setError(ERROR_MESSAGES.ANSWER_SUBMISSION_FAILED);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [
    followUpAnswer, 
    candidateId, 
    interviewSetup, 
    currentQuestion, 
    answer, 
    followUpQuestion, 
    followUpLevel, 
    interactions, 
    voiceRecordings
  ]);

  const completeInterview = useCallback(async () => {
    try {
      setLoading(true);
      
      // Stop screen capture
      if (screenshotInterval.current) {
        clearInterval(screenshotInterval.current);
      }
      audioService.stopScreenCapture();
      
      // Clean up audio service
      audioService.cleanup();
      
      // Save interview data
      const result = await apiService.completeInterview(
        candidateId,
        sessionId,
        interactions,
        voiceRecordings,
        screenshots
      );
      
      setInterviewState(INTERVIEW_STATES.COMPLETED);
      
      console.log('✅ Interview completed successfully:', result);
      return result;
    } catch (error) {
      console.error('Interview completion failed:', error);
      setError('Failed to complete interview');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [candidateId, sessionId, interactions, voiceRecordings, screenshots]);

  // =========================
  // CLEANUP
  // =========================

  const cleanup = useCallback(() => {
    // Clear intervals
    if (screenshotInterval.current) {
      clearInterval(screenshotInterval.current);
    }
    
    // Clean up audio service
    audioService.cleanup();
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.CANDIDATE_ID);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    
    // Reset state
    setInterviewState(INTERVIEW_STATES.NOT_STARTED);
    setCurrentQuestion(0);
    setAnswer('');
    setInteractions([]);
    setVoiceRecordings([]);
    setScreenshots([]);
    
    console.log('🧹 Interview cleanup completed');
  }, []);

  // =========================
  // UTILITY FUNCTIONS
  // =========================

  const getInterviewProgress = useCallback(() => {
    if (!questions.length) return 0;
    return Math.round((currentQuestion / questions.length) * 100);
  }, [currentQuestion, questions.length]);

  const getCurrentQuestionText = useCallback(() => {
    if (!questions.length || currentQuestion >= questions.length) return '';
    return questions[currentQuestion];
  }, [questions, currentQuestion]);

  const isLastQuestion = useCallback(() => {
    return currentQuestion >= questions.length - 1;
  }, [currentQuestion, questions.length]);

  const getSessionSummary = useCallback(() => {
    return {
      candidateId,
      sessionId,
      totalQuestions: questions.length,
      answeredQuestions: interactions.length,
      currentQuestion: currentQuestion + 1,
      voiceRecordings: voiceRecordings.length,
      screenshots: screenshots.length,
      averageScore: interactions.length > 0 
        ? interactions.reduce((sum, i) => sum + (i.score || 0), 0) / interactions.length 
        : 0,
      completionPercentage: getInterviewProgress()
    };
  }, [candidateId, sessionId, questions.length, interactions, currentQuestion, voiceRecordings.length, screenshots.length, getInterviewProgress]);

  // =========================
  // RETURN INTERFACE
  // =========================

  return {
    // State
    candidateId,
    sessionId,
    interviewState,
    interviewSetup,
    currentQuestion,
    answer,
    questions,
    interactions,
    score,
    feedback,
    showFollowUp,
    followUpQuestion,
    followUpAnswer,
    followUpLevel,
    loading,
    error,
    progress,
    voiceRecordings,
    screenshots,
    isAudioEnabled,
    isVideoEnabled,

    // Actions
    setCandidateId,
    setAnswer,
    setFollowUpAnswer,
    setIsAudioEnabled,
    setIsVideoEnabled,
    setupInterview,
    startInterview,
    submitAnswer,        // Now accepts optional answerText parameter
    submitFollowUp,      // Now accepts optional followUpAnswerText parameter
    nextQuestion,
    completeInterview,
    recordAnswer,
    cleanup,

    // Utilities
    getInterviewProgress,
    getCurrentQuestionText,
    isLastQuestion,
    getSessionSummary,

    // Audio service access
    audioService
  };
};

export default useInterview;