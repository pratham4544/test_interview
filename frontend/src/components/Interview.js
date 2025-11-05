// frontend/src/components/Interview.js - FIXED VERSION with Proper State Management
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useInterview from '../hooks/useInterview';
import apiService from '../services/api';
import audioService from '../services/audioService';
import { 
  INTERVIEW_STATES, 
  VOICE_STATES, 
  GRADIENTS, 
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  BROWSER_SUPPORT
} from '../utils/constants';

const Interview = ({ candidateId, onComplete, onBack, videoStream: propVideoStream, threshold = 7 }) => {
  // Interview management
  const {
    interviewState,
    interviewSetup,
    currentQuestion,
    answer,
    setAnswer,
    questions,
    score,
    feedback,
    showFollowUp,
    followUpQuestion,
    followUpAnswer,
    setFollowUpAnswer,
    followUpLevel,
    loading,
    error,
    setupInterview,
    startInterview,
    submitAnswer,
    submitFollowUp,
    nextQuestion,
    completeInterview,
    getInterviewProgress,
    getCurrentQuestionText,
    isLastQuestion,
    cleanup
  } = useInterview();

  // Audio/Video state
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // UI state
  const [autoMode, setAutoMode] = useState(true);
  const [speakQuestions, setSpeakQuestions] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [scoreThreshold, setScoreThreshold] = useState(threshold);

  // **CRITICAL FIX: Track follow-up counter AND prevent re-submission during transition**
  const followUpCounterRef = useRef(0);
  const isTransitioningRef = useRef(false); // NEW: Prevent submissions during state transitions

  // Enhanced data capture with complete storage
  const [capturedData, setCapturedData] = useState({
    candidateId,
    threshold: scoreThreshold,
    startTime: new Date().toISOString(),
    questions: [],
    screenshots: [],
    audioRecordings: [],
    interactions: [],
    transcriptions: [],
    metadata: {}
  });

  // Refs
  const recordingTimer = useRef(null);
  const speechTimeout = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpeechTimeRef = useRef(0);
  const transcriptBackup = useRef('');
  const isProcessingSubmission = useRef(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenshotIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    const storageKey = `interview_data_${candidateId}`;
    try {
      // Only save essential data - avoid localStorage quota issues
      const essentialData = {
        candidateId: capturedData.candidateId,
        startTime: capturedData.startTime,
        currentQuestion,
        interactions: capturedData.interactions.slice(-5), // Last 5 interactions only
        totalQuestions: capturedData.totalQuestions
      };
      localStorage.setItem(storageKey, JSON.stringify(essentialData));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️ Storage quota exceeded, clearing old data');
        localStorage.clear();
      }
    }
  }, [capturedData, candidateId, currentQuestion]);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      if (propVideoStream) {
        setVideoStream(propVideoStream);
        if (videoRef.current) {
          videoRef.current.srcObject = propVideoStream;
          try {
            await videoRef.current.play();
          } catch (err) {
            console.error('Video play failed:', err);
          }
        }
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' }, 
            audio: false 
          });
          setVideoStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        } catch (error) {
          console.error('Camera access failed:', error);
        }
      }
    };

    initCamera();
  }, [propVideoStream]);

  // Store questions when loaded
  useEffect(() => {
    if (questions.length > 0) {
      setCapturedData(prev => ({
        ...prev,
        questions: questions,
        totalQuestions: questions.length
      }));
    }
  }, [questions]);

  // Enable fullscreen
  useEffect(() => {
    enterFullscreen();
  }, []);

  const enterFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.error('Fullscreen failed:', error);
    }
  };

  // Disable mouse events
  useEffect(() => {
    if (interviewState === INTERVIEW_STATES.IN_PROGRESS) {
      const preventContextMenu = (e) => e.preventDefault();
      const preventCopy = (e) => e.preventDefault();
      
      document.addEventListener('contextmenu', preventContextMenu);
      document.addEventListener('copy', preventCopy);
      document.addEventListener('cut', preventCopy);
      document.addEventListener('paste', preventCopy);
      
      return () => {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('copy', preventCopy);
        document.removeEventListener('cut', preventCopy);
        document.removeEventListener('paste', preventCopy);
      };
    }
  }, [interviewState]);

  // Monitor fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement || 
                                     document.webkitFullscreenElement || 
                                     document.mozFullScreenElement || 
                                     document.msFullscreenElement;
      
      if (!isCurrentlyFullscreen && interviewState === INTERVIEW_STATES.IN_PROGRESS) {
        alert('Warning: Please remain in fullscreen mode during the interview');
        enterFullscreen();
      }
      
      setIsFullscreen(!!isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [interviewState]);

  // Screenshot capture function
  const captureScreenshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Start periodic screenshots
  const startScreenshotCapture = useCallback(() => {
    const captureAndStore = () => {
      const screenshot = captureScreenshot();
      if (screenshot) {
        const timestamp = new Date().toISOString();
        setCapturedData(prev => ({
          ...prev,
          screenshots: [...prev.screenshots.slice(-10), { // Keep only last 10 screenshots
            timestamp,
            data: screenshot,
            questionIndex: currentQuestion
          }]
        }));
      }
    };

    captureAndStore();
    screenshotIntervalRef.current = setInterval(captureAndStore, 30000);
  }, [captureScreenshot, currentQuestion]);

  // TTS function
  const speakText = useCallback(async (text, isQuestion = false) => {
    try {
      setIsSpeaking(true);
      console.log(`🗣️ Speaking: ${text.substring(0, 50)}...`);
      
      const audioData = await apiService.requestTTS(text, candidateId, isQuestion ? 'pre-generated' : 'runtime');
      
      if (audioData && audioData.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${audioData.audio_base64}`);
        
        audio.onended = () => {
          setIsSpeaking(false);
          console.log('✅ Speech completed');
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          console.error('❌ Audio playback failed');
        };
        
        await audio.play();
      }
    } catch (error) {
      console.error('TTS Error:', error);
      setIsSpeaking(false);
    }
  }, [candidateId]);

  // Start listening function
  const startListening = useCallback(async () => {
    if (!autoMode || isListening || isSpeaking) return;

    try {
      setIsListening(true);
      setIsRecording(true);
      
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        let finalTranscript = '';
        lastSpeechTimeRef.current = Date.now();
        
        recognition.onresult = (event) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
          
          const fullText = finalTranscript + interimTranscript;
          
          if (showFollowUp) {
            setFollowUpAnswer(fullText);
          } else {
            setAnswer(fullText);
          }
          
          transcriptBackup.current = fullText;
          lastSpeechTimeRef.current = Date.now();
          
          // Auto-submit after 3 seconds of silence
          clearTimeout(speechTimeout.current);
          speechTimeout.current = setTimeout(() => {
            const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
            if (timeSinceLastSpeech >= 3000 && fullText.trim().length > 0) {
              console.log('🤖 Auto-submitting after 3s silence');
              recognition.stop();
              handleAutoSubmit();
            }
          }, 3000);
        };
        
        recognition.onerror = (event) => {
          console.error('Recognition error:', event.error);
          setIsListening(false);
          setIsRecording(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
          setIsRecording(false);
        };
        
        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  }, [autoMode, isListening, isSpeaking, showFollowUp, setAnswer, setFollowUpAnswer]);

  // Stop listening function
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsRecording(false);
    clearTimeout(speechTimeout.current);
  }, []);

  // Store interaction with dynamic threshold logic
  const storeInteraction = useCallback((questionText, answerText, scoreValue, feedbackValue) => {
    const interaction = {
      timestamp: new Date().toISOString(),
      questionIndex: currentQuestion,
      question: questionText,
      answer: answerText,
      score: scoreValue,
      feedback: feedbackValue,
      isFollowUp: showFollowUp,
      followUpCount: followUpCounterRef.current,
      threshold: scoreThreshold,
      passedThreshold: scoreValue >= scoreThreshold
    };
    
    setCapturedData(prev => ({
      ...prev,
      interactions: [...prev.interactions, interaction]
    }));
  }, [currentQuestion, showFollowUp, scoreThreshold]);

  // **CRITICAL FIX: Main Answer Handler with Proper State Management**
  const handleSubmitAnswer = useCallback(async () => {
    // Prevent submission during transitions
    if (isTransitioningRef.current) {
      console.log('⏸️ Skipping submission - transitioning between questions');
      return;
    }

    try {
      const currentAnswerValue = answer || transcriptBackup.current;
      
      console.log('🔍 FRONTEND DEBUG - About to submit main answer:', {
        currentQuestion,
        questionText: getCurrentQuestionText(),
        answerLength: currentAnswerValue.length,
        answerPreview: currentAnswerValue.substring(0, 100) + '...',
        threshold: scoreThreshold,
        followUpCounter: followUpCounterRef.current,
        showFollowUp,
        isProcessing: isProcessingSubmission.current
      });
      
      if (!currentAnswerValue.trim()) {
        console.log('❌ Empty answer - aborting submission');
        isProcessingSubmission.current = false;
        return;
      }
      
      console.log('🚀 Calling submitAnswer API...');
      const result = await submitAnswer(currentAnswerValue);
      
      console.log('🔍 FRONTEND DEBUG - Backend response received:', {
        score: result.score,
        needsFollowup: result.needs_followup,
        hasFollowUpQuestion: !!result.follow_up_question,
        currentQuestion,
        threshold: scoreThreshold
      });
      
      if (result) {
        storeInteraction(
          getCurrentQuestionText(),
          currentAnswerValue,
          result.score,
          result.feedback
        );
        
        transcriptBackup.current = '';
        
        console.log(`Main answer - Score: ${result.score}, Threshold: ${scoreThreshold}, Follow-up counter: ${followUpCounterRef.current}`);
        
        // Check if follow-up needed (score below threshold AND less than 2 follow-ups)
        if (result.needs_followup && result.follow_up_question && result.score < scoreThreshold && followUpCounterRef.current < 2) {
          followUpCounterRef.current += 1;
          console.log(`✅ Follow-up #${followUpCounterRef.current} triggered (score ${result.score} < threshold ${scoreThreshold})`);
          
          setTimeout(async () => {
            if (speakQuestions) {
              console.log('🗣️ Speaking follow-up question...');
              await speakText(result.follow_up_question, true);
            }
          }, 1500);
        } else {
          console.log(`✅ Moving to next question (score ${result.score} >= ${scoreThreshold} OR max follow-ups reached)`);
          followUpCounterRef.current = 0; // RESET counter for next question
          
          setTimeout(() => {
            console.log(`🔍 Calling handleNextQuestion...`);
            handleNextQuestion();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ Answer submission failed:', error);
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [answer, submitAnswer, speakQuestions, storeInteraction, getCurrentQuestionText, scoreThreshold, currentQuestion]);

  // **CRITICAL FIX: Follow-up Handler**
  const handleSubmitFollowUp = useCallback(async () => {
    // Prevent submission during transitions
    if (isTransitioningRef.current) {
      console.log('⏸️ Skipping follow-up submission - transitioning between questions');
      return;
    }

    try {
      const currentFollowUpValue = followUpAnswer || transcriptBackup.current;
      
      console.log('🔍 FRONTEND DEBUG - About to submit follow-up answer:', {
        currentQuestion,
        followUpQuestionText: followUpQuestion,
        followUpAnswerLength: currentFollowUpValue.length,
        followUpAnswerPreview: currentFollowUpValue.substring(0, 100) + '...',
        threshold: scoreThreshold,
        followUpCounter: followUpCounterRef.current
      });
      
      if (!currentFollowUpValue.trim()) {
        console.log('❌ Empty follow-up answer - aborting submission');
        isProcessingSubmission.current = false;
        return;
      }
      
      console.log('🚀 Calling submitFollowUp API...');
      const result = await submitFollowUp(currentFollowUpValue);
      
      if (result) {
        storeInteraction(
          followUpQuestion,
          currentFollowUpValue,
          result.score,
          result.feedback
        );
        
        transcriptBackup.current = '';
        
        console.log(`Follow-up #${followUpCounterRef.current} submitted - Score: ${result.score}, Threshold: ${scoreThreshold}`);
        
        // Check if another follow-up needed
        if (result.needs_followup && result.follow_up_question && result.score < scoreThreshold && followUpCounterRef.current < 2) {
          followUpCounterRef.current += 1;
          console.log(`✅ Follow-up #${followUpCounterRef.current} triggered`);
          
          setTimeout(async () => {
            if (speakQuestions) {
              await speakText(result.follow_up_question, true);
            }
          }, 1500);
        } else {
          console.log(`✅ Moving to next question`);
          followUpCounterRef.current = 0;
          
          setTimeout(() => {
            handleNextQuestion();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ Follow-up submission failed:', error);
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [followUpAnswer, submitFollowUp, speakQuestions, followUpQuestion, storeInteraction, scoreThreshold, currentQuestion]);

  const handleAutoSubmit = useCallback(async () => {
    if (isProcessingSubmission.current || isTransitioningRef.current) {
      console.log('⏳ Already processing or transitioning - skipping auto submit');
      return;
    }
    
    isProcessingSubmission.current = true;
    
    try {
      console.log('🤖 Auto-submit triggered:', { showFollowUp });
      if (showFollowUp) {
        await handleSubmitFollowUp();
      } else {
        await handleSubmitAnswer();
      }
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [showFollowUp, handleSubmitAnswer, handleSubmitFollowUp]);

  // **CRITICAL FIX: Proper State-Aware Next Question Handler**
  const handleNextQuestion = useCallback(() => {
    console.log(`🔍 handleNextQuestion called:`, {
      currentQuestion,
      totalQuestions: questions.length,
      isLast: isLastQuestion(),
      followUpCounter: followUpCounterRef.current
    });
    
    // Block new submissions during transition
    isTransitioningRef.current = true;
    
    if (isLastQuestion()) {
      console.log(`✅ Last question reached - completing interview`);
      handleCompleteInterview();
      return;
    }
    
    // Calculate next question index BEFORE state update
    const nextQuestionIndex = currentQuestion + 1;
    console.log(`🔍 Moving from question ${currentQuestion} to ${nextQuestionIndex}`);
    
    // Update state
    nextQuestion();
    
    // Use the calculated index, not the state value
    setTimeout(() => {
      console.log(`🔍 State updated to question ${nextQuestionIndex}`);
      
      // Get the actual question using the calculated index
      const nextQ = questions[nextQuestionIndex];
      if (nextQ) {
        const nextQuestionText = nextQ.question || nextQ;
        console.log(`🔍 Next question text: ${nextQuestionText.substring(0, 50)}...`);
        
        if (speakQuestions) {
          setTimeout(async () => {
            await speakText(`Question ${nextQuestionIndex + 1}: ${nextQuestionText}`, true);
            
            // Allow submissions again after speaking
            setTimeout(() => {
              isTransitioningRef.current = false;
              
              if (autoMode) {
                console.log('🤖 Starting listening for next question...');
                startListening();
              }
            }, 1000);
          }, 500);
        } else {
          isTransitioningRef.current = false;
          
          if (autoMode) {
            setTimeout(() => {
              startListening();
            }, 500);
          }
        }
      } else {
        console.error(`❌ Could not find question at index ${nextQuestionIndex}`);
        isTransitioningRef.current = false;
      }
    }, 200); // Wait for state update
  }, [currentQuestion, questions, isLastQuestion, nextQuestion, speakQuestions, autoMode, startListening]);

  const handleCompleteInterview = useCallback(async () => {
    try {
      console.log('🏁 Completing interview...');
      stopListening();
      
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      
      const finalData = {
        ...capturedData,
        endTime: new Date().toISOString(),
        totalQuestionsAnswered: currentQuestion + 1
      };
      
      setCapturedData(finalData);
      
      // Save final data
      const storageKey = `interview_complete_${candidateId}`;
      localStorage.setItem(storageKey, JSON.stringify(finalData));
      
      await completeInterview();
      
      if (onComplete) {
        onComplete(finalData);
      }
    } catch (error) {
      console.error('Error completing interview:', error);
    }
  }, [capturedData, currentQuestion, candidateId, stopListening, completeInterview, onComplete]);

  const handleStartInterview = useCallback(async () => {
    try {
      console.log('🚀 Starting interview...');
      await startInterview();
      
      startScreenshotCapture();
      
      if (speakQuestions && interviewSetup?.greeting) {
        await speakText(interviewSetup.greeting, false);
        
        setTimeout(async () => {
          const firstQuestion = getCurrentQuestionText();
          if (firstQuestion) {
            await speakText(`Question 1: ${firstQuestion}`, true);
            
            if (autoMode) {
              setTimeout(() => {
                startListening();
              }, 1000);
            }
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
    }
  }, [startInterview, speakQuestions, interviewSetup, autoMode, getCurrentQuestionText, speakText, startListening, startScreenshotCapture]);

  // Setup interview on mount
  useEffect(() => {
    if (candidateId) {
      setupInterview(candidateId);
    }
  }, [candidateId, setupInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      cleanup();
    };
  }, [cleanup, stopListening, videoStream]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    }
    
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [isRecording]);

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Error</div>
          <div style={{ fontSize: '16px', opacity: 0.9 }}>{error}</div>
          <button
            onClick={onBack}
            style={{
              marginTop: '30px',
              padding: '12px 30px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (interviewState === INTERVIEW_STATES.NOT_STARTED) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '60px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px'
          }}>🎯</div>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '15px'
          }}>Ready to Begin?</h2>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            marginBottom: '30px',
            lineHeight: '1.6'
          }}>
            This AI-powered interview will assess your skills through a series of questions. 
            Speak clearly and take your time with each answer.
          </p>
          <button
            onClick={handleStartInterview}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s',
              transform: loading ? 'none' : 'scale(1)'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => !loading && (e.target.style.transform = 'scale(1)')}
          >
            {loading ? 'Loading...' : 'Start Interview'}
          </button>
        </div>
      </div>
    );
  }

  if (interviewState === INTERVIEW_STATES.COMPLETED) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '60px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px'
          }}>✅</div>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '15px'
          }}>Interview Complete!</h2>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            marginBottom: '30px'
          }}>
            Thank you for completing the interview. Your responses have been recorded.
          </p>
          <button
            onClick={onComplete}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Hidden canvas for screenshots */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        background: 'rgba(255, 255, 255, 0.2)',
        height: '6px'
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
          height: '100%',
          width: `${getInterviewProgress()}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>

      {/* Main Interview Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative'
      }}>
        {/* AI Avatar Circle */}
        <div style={{
          position: 'absolute',
          left: '15%',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: isSpeaking 
            ? 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)'
            : 'rgba(255, 255, 255, 0.95)',
          border: `6px solid ${isSpeaking ? '#10b981' : 'rgba(255, 255, 255, 0.5)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          transform: isSpeaking ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.4s ease',
          boxShadow: isSpeaking 
            ? '0 20px 60px rgba(16, 185, 129, 0.4)' 
            : '0 20px 60px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            fontSize: '64px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '15px'
          }}>
            AI
          </div>
          <div style={{
            fontSize: '16px',
            color: isSpeaking ? '#10b981' : '#6b7280',
            fontWeight: '600'
          }}>
            {isSpeaking ? 'Speaking...' : loading ? 'Analyzing...' : 'Listening'}
          </div>
        </div>

        {/* Candidate Video Circle */}
        <div style={{
          position: 'absolute',
          right: '15%',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: `6px solid ${isRecording ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)'}`,
          transform: isRecording ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.4s ease',
          boxShadow: isRecording 
            ? '0 20px 60px rgba(245, 158, 11, 0.4)' 
            : '0 20px 60px rgba(0, 0, 0, 0.2)',
          background: '#1f2937'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)'
            }}
          />
          {isRecording && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(245, 158, 11, 0.95)',
              color: 'white',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'white',
                animation: 'pulse 1.5s infinite'
              }} />
              {recordingTime}s
            </div>
          )}
        </div>

        {/* Question Display Card */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.98)',
          padding: '30px 50px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          maxWidth: '600px',
          textAlign: 'center',
          zIndex: 100
        }}>
          <div style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginBottom: '15px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            Question {currentQuestion + 1} of {questions.length}
          </div>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            lineHeight: '1.6'
          }}>
            {getCurrentQuestionText()}
          </div>
          {showFollowUp && (
            <div style={{
              marginTop: '15px',
              padding: '12px 20px',
              background: '#fef3c7',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#92400e',
              fontWeight: '500'
            }}>
              Follow-up Question #{followUpCounterRef.current}
            </div>
          )}
        </div>

        {/* Live Transcription Display */}
        {(answer || followUpAnswer) && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '20px 30px',
            borderRadius: '16px',
            maxWidth: '700px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            border: '2px solid rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Your Response
            </div>
            <div style={{
              fontSize: '16px',
              color: '#374151',
              lineHeight: '1.5'
            }}>
              {showFollowUp ? followUpAnswer : answer}
            </div>
          </div>
        )}
      </div>

      {/* Floating Status Indicator */}
      <div style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        display: 'flex',
        gap: '15px',
        zIndex: 100
      }}>
        {isRecording && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.95)',
            padding: '12px 24px',
            borderRadius: '30px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.4)'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'white',
              animation: 'pulse 1.5s infinite'
            }} />
            Recording
          </div>
        )}
        {loading && (
          <div style={{
            background: 'rgba(102, 126, 234, 0.95)',
            padding: '12px 24px',
            borderRadius: '30px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)'
          }}>
            Processing...
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.8);
          }
        }
      `}</style>
    </div>
  );
};

export default Interview;