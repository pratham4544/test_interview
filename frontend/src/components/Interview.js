// frontend/src/components/Interview.js - Complete Enhanced Version with Fixed Logic
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

  // **CRITICAL FIX: Track follow-up counter per question**
  const followUpCounterRef = useRef(0);

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
    localStorage.setItem(storageKey, JSON.stringify(capturedData));
  }, [capturedData, candidateId]);

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
          screenshots: [...prev.screenshots, {
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

  // Start audio recording
  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const timestamp = new Date().toISOString();
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedData(prev => ({
            ...prev,
            audioRecordings: [...prev.audioRecordings, {
              timestamp,
              data: reader.result,
              questionIndex: currentQuestion,
              duration: recordingTime
            }]
          }));
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (error) {
      console.error('Audio recording failed:', error);
    }
  }, [currentQuestion, recordingTime]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // TTS
  const speakText = async (text, shouldAutoStart = true) => {
    try {
      setIsSpeaking(true);
      setVoiceState(VOICE_STATES.SPEAKING);

      const ttsResult = await apiService.getTextToSpeech(text, candidateId);
      
      if (ttsResult.success && ttsResult.audio_base64) {
        await audioService.playAudioFromBase64(ttsResult.audio_base64);
      }
    } catch (error) {
      console.error('TTS failed:', error);
    } finally {
      setIsSpeaking(false);
      setVoiceState(VOICE_STATES.IDLE);
      
      if (autoMode && !isRecording && shouldAutoStart) {
        setTimeout(() => {
          startListening();
        }, 500);
      }
    }
  };

  // Voice Recognition with transcription storage
  const startListening = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
        return;
      }

      setIsListening(true);
      setIsRecording(true);
      setVoiceState(VOICE_STATES.LISTENING);
      setRecordingTime(0);
      
      isProcessingSubmission.current = false;
      
      await startAudioRecording();
      
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      let finalTranscript = '';
      let lastSpeechTime = Date.now();
      let silenceTimer = null;
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscript = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        const fullTranscript = (finalTranscript + interimTranscript).trim();
        
        if (fullTranscript) {
          transcriptBackup.current = fullTranscript;
          
          // Store transcription in real-time
          setCapturedData(prev => ({
            ...prev,
            transcriptions: [...prev.transcriptions.filter(t => t.questionIndex !== currentQuestion || t.isFinal), {
              timestamp: new Date().toISOString(),
              questionIndex: currentQuestion,
              text: fullTranscript,
              isFinal: event.results[event.results.length - 1].isFinal,
              isFollowUp: showFollowUp
            }]
          }));
          
          if (showFollowUp) {
            setFollowUpAnswer(fullTranscript);
          } else {
            setAnswer(fullTranscript);
          }
          
          lastSpeechTime = Date.now();
          lastSpeechTimeRef.current = lastSpeechTime;
          
          if (silenceTimer) {
            clearTimeout(silenceTimer);
          }
          
          if (autoMode && !isProcessingSubmission.current && fullTranscript.length >= 10) {
            silenceTimer = setTimeout(() => {
              const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
              if (timeSinceSpeech >= 3000 && !isProcessingSubmission.current) {
                stopListening();
              }
            }, 3000);
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'aborted') {
          return;
        }
        
        if (event.error === 'network') {
          setTimeout(() => {
            if (!isProcessingSubmission.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error('Retry failed:', e);
              }
            }
          }, 1000);
          return;
        }
        
        if (event.error !== 'no-speech') {
          setVoiceState(VOICE_STATES.ERROR);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
        setVoiceState(VOICE_STATES.IDLE);
        
        stopAudioRecording();
        
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
        }
        
        if (!isProcessingSubmission.current && transcriptBackup.current.length >= 10) {
          handleAutoSubmit();
        }
      };
      
      recognition.start();
      
    } catch (error) {
      console.error('Speech recognition failed:', error);
      setVoiceState(VOICE_STATES.ERROR);
      setIsListening(false);
      setIsRecording(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    stopAudioRecording();
    
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    
    setIsListening(false);
    setIsRecording(false);
    setVoiceState(VOICE_STATES.IDLE);
  };

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

  // **FIXED: Main Answer Handler with Correct Logic**
  const handleSubmitAnswer = useCallback(async () => {
    try {
      const currentAnswerValue = answer || transcriptBackup.current;
      
      if (!currentAnswerValue.trim()) {
        isProcessingSubmission.current = false;
        return;
      }
      
      const result = await submitAnswer(currentAnswerValue);
      
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
          console.log(`Follow-up #${followUpCounterRef.current} triggered (score ${result.score} < threshold ${scoreThreshold})`);
          
          setTimeout(async () => {
            if (speakQuestions) {
              await speakText(result.follow_up_question, true);
            }
          }, 1500);
        } else {
          console.log(`Moving to next question (score ${result.score} >= ${scoreThreshold} OR max follow-ups reached)`);
          followUpCounterRef.current = 0; // RESET counter for next question
          setTimeout(() => handleNextQuestion(), 1000);
        }
      }
    } catch (error) {
      console.error('Answer submission failed:', error);
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [answer, submitAnswer, speakQuestions, storeInteraction, getCurrentQuestionText, scoreThreshold]);

  // **FIXED: Follow-up Handler with Correct Logic**
  const handleSubmitFollowUp = useCallback(async () => {
    try {
      const currentFollowUpValue = followUpAnswer || transcriptBackup.current;
      
      if (!currentFollowUpValue.trim()) {
        isProcessingSubmission.current = false;
        return;
      }
      
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
        
        // Check if another follow-up needed (score below threshold AND haven't done 2 follow-ups yet)
        if (result.needs_followup && result.follow_up_question && result.score < scoreThreshold && followUpCounterRef.current < 2) {
          followUpCounterRef.current += 1;
          console.log(`Follow-up #${followUpCounterRef.current} triggered (score ${result.score} < threshold ${scoreThreshold})`);
          
          setTimeout(async () => {
            if (speakQuestions) {
              await speakText(result.follow_up_question, true);
            }
          }, 1500);
        } else {
          console.log(`Moving to next question (score ${result.score} >= ${scoreThreshold} OR completed ${followUpCounterRef.current} follow-ups)`);
          followUpCounterRef.current = 0; // RESET counter for next question
          setTimeout(() => handleNextQuestion(), 1000);
        }
      }
    } catch (error) {
      console.error('Follow-up submission failed:', error);
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [followUpAnswer, submitFollowUp, speakQuestions, followUpQuestion, storeInteraction, scoreThreshold]);

  const handleAutoSubmit = useCallback(async () => {
    if (isProcessingSubmission.current) {
      return;
    }
    
    isProcessingSubmission.current = true;
    
    try {
      if (showFollowUp) {
        await handleSubmitFollowUp();
      } else {
        await handleSubmitAnswer();
      }
    } finally {
      isProcessingSubmission.current = false;
    }
  }, [showFollowUp, handleSubmitAnswer, handleSubmitFollowUp]);

  const handleNextQuestion = useCallback(async () => {
    if (isLastQuestion()) {
      await handleCompleteInterview();
    } else {
      nextQuestion();
      
      if (speakQuestions) {
        setTimeout(async () => {
          const nextQuestionText = getCurrentQuestionText();
          if (nextQuestionText) {
            await speakText(`Question ${currentQuestion + 2}: ${nextQuestionText}`, true);
          }
        }, 1000);
      } else {
        if (autoMode) {
          setTimeout(() => startListening(), 500);
        }
      }
    }
  }, [isLastQuestion, nextQuestion, currentQuestion, speakQuestions, autoMode]);

  const handleCompleteInterview = async () => {
    try {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      
      const result = await completeInterview();
      
      if (speakQuestions) {
        await speakText("Thank you for completing the interview.", false);
      }
      
      const finalData = {
        ...capturedData,
        endTime: new Date().toISOString(),
        completionResult: result,
        metadata: {
          candidateId,
          threshold: scoreThreshold,
          completedAt: new Date().toISOString(),
          totalQuestions: questions.length,
          totalInteractions: capturedData.interactions.length,
          totalScreenshots: capturedData.screenshots.length,
          totalAudioRecordings: capturedData.audioRecordings.length,
          totalTranscriptions: capturedData.transcriptions.length,
          passedInteractions: capturedData.interactions.filter(i => i.passedThreshold).length
        }
      };
      
      localStorage.setItem('interview_data_' + candidateId, JSON.stringify(finalData));
      
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      
      onComplete?.(result, finalData);
    } catch (error) {
      console.error('Interview completion failed:', error);
    }
  };

  const handleStartInterview = async () => {
    try {
      await startInterview();
      followUpCounterRef.current = 0; // Initialize counter
      startScreenshotCapture();
      
      if (speakQuestions && interviewSetup?.greeting) {
        await speakText(interviewSetup.greeting, false);
        
        setTimeout(async () => {
          const firstQuestion = getCurrentQuestionText();
          if (firstQuestion) {
            await speakText(`Question 1: ${firstQuestion}`, true);
          }
        }, 1000);
      } else {
        if (autoMode) {
          setTimeout(() => startListening(), 500);
        }
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
    }
  };

  useEffect(() => {
    if (candidateId) {
      setupInterview(candidateId);
    }
    
    return () => {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (videoStream && !propVideoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      cleanup();
    };
  }, [candidateId]);

  useEffect(() => {
    if (interviewState === INTERVIEW_STATES.SETUP && interviewSetup) {
      handleStartInterview();
    }
  }, [interviewState, interviewSetup]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative'
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Progress & Controls Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
            AI Interview
          </div>
          <div style={{
            background: '#f3f4f6',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Question {currentQuestion + 1} / {questions.length}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            background: '#e0e7ff',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            color: '#4f46e5',
            fontWeight: '500'
          }}>
            Threshold: {scoreThreshold}
          </div>
          {showFollowUp && (
            <div style={{
              background: '#fef3c7',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              color: '#92400e',
              fontWeight: '500'
            }}>
              Follow-up {followUpCounterRef.current}/2
            </div>
          )}
          {autoMode && (
            <div style={{
              background: '#d1fae5',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              color: '#10b981',
              fontWeight: '500'
            }}>
              Auto-submit ON
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.3)',
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
            Current Question
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