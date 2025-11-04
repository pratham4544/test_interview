// frontend/src/components/Interview.js - Fixed Follow-up Question Flow
// Issue: Follow-up questions generate but no UI to answer them

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

const Interview = ({ candidateId, onComplete, onBack }) => {
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
  const [transcriptionText, setTranscriptionText] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPermission, setAudioPermission] = useState(null);
  const [screenPermission, setScreenPermission] = useState(null);

  // UI state
  const [showPermissions, setShowPermissions] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const [speakQuestions, setSpeakQuestions] = useState(true);

  // Refs
  const recordingTimer = useRef(null);
  const speechTimeout = useRef(null);

  // =========================
  // DEBUG: Log follow-up state changes
  // =========================
  useEffect(() => {
    console.log('Follow-up state changed:', {
      showFollowUp,
      followUpQuestion,
      followUpAnswer,
      currentQuestion
    });
  }, [showFollowUp, followUpQuestion, followUpAnswer, currentQuestion]);

  // Add this helper function in your Interview component
const extractFollowUpQuestion = (rawQuestion) => {
  if (!rawQuestion) return '';
  
  // Look for patterns that indicate the actual question
  const patterns = [
    /Here's a potential follow-up question:\s*(.+?)(?:\s*This question:|\s*\*|$)/s,
    /follow-up question:\s*(.+?)(?:\s*This question:|\s*\*|$)/s,
    /Question:\s*(.+?)(?:\s*This|\s*\*|$)/s,
    /\?\s*(.+?\?)/s  // Find text ending with question mark
  ];
  
  for (const pattern of patterns) {
    const match = rawQuestion.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: try to find the last question mark sentence
  const sentences = rawQuestion.split(/[.!]/).filter(s => s.includes('?'));
  if (sentences.length > 0) {
    return sentences[sentences.length - 1].trim();
  }
  
  return rawQuestion; // Return as-is if no pattern matches
};

  // =========================
  // HELPER FUNCTIONS FOR FOLLOW-UP DISPLAY
  // =========================

  // Get the current question to display (main question or follow-up)
  const getDisplayQuestion = () => {
  if (showFollowUp && followUpQuestion) {
    const cleanQuestion = extractFollowUpQuestion(followUpQuestion);
    console.log('Extracted follow-up question:', cleanQuestion);
    return cleanQuestion;
  }
  
  const mainQuestion = getCurrentQuestionText();
  return mainQuestion;
};

  // Get the current answer value (main answer or follow-up answer)
  const getCurrentAnswer = () => {
    const currentAnswer = showFollowUp ? followUpAnswer : answer;
    console.log('getCurrentAnswer:', { showFollowUp, currentAnswer });
    return currentAnswer;
  };

  // Set the current answer value
  const setCurrentAnswer = (value) => {
    console.log('setCurrentAnswer:', { showFollowUp, value });
    if (showFollowUp) {
      setFollowUpAnswer(value);
    } else {
      setAnswer(value);
    }
  };

  // Get question number display
  const getQuestionNumber = () => {
    if (showFollowUp) {
      return `Question ${currentQuestion + 1} - Follow-up`;
    }
    return `Question ${currentQuestion + 1} of ${questions.length}`;
  };

  // Get placeholder text
  const getPlaceholder = () => {
    if (showFollowUp) {
      return "Please provide more details for the follow-up question...";
    }
    return "Type your answer here or use voice recording...";
  };

  // =========================
  // EXISTING FUNCTIONS
  // =========================

  useEffect(() => {
    if (candidateId) {
      initializeInterview();
    }
    
    return () => {
      cleanup();
      clearTimers();
    };
  }, [candidateId]);

  const initializeInterview = async () => {
    try {
      const support = BROWSER_SUPPORT.checkSupport();
      if (!support.isSupported) {
        throw new Error(`Browser not supported: ${support.recommendations.join(', ')}`);
      }

      await setupInterview(candidateId);
      await checkPermissions();
      
    } catch (error) {
      console.error('Interview initialization failed:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const micResult = await audioService.checkMicrophonePermission();
      setAudioPermission(micResult.granted);
      
      const audioResult = await audioService.initialize();
      if (!audioResult.success) {
        console.warn('Audio service initialization failed');
      }

      console.log('Permissions checked:', { audio: micResult.granted });
    } catch (error) {
      console.error('Permission check failed:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const micResult = await audioService.requestMicrophonePermission();
      setAudioPermission(micResult.granted);

      try {
        await audioService.startScreenCapture();
        setScreenPermission(true);
      } catch (error) {
        console.warn('Screen capture not available:', error);
        setScreenPermission(false);
      }

      if (micResult.granted) {
        setShowPermissions(false);
        await startInterview();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  const speakText = async (text) => {
    try {
      setIsSpeaking(true);
      setVoiceState(VOICE_STATES.SPEAKING);

      const ttsResult = await apiService.getTextToSpeech(text, candidateId);
      
      if (ttsResult.success && ttsResult.audio_base64) {
        await audioService.playAudioFromBase64(ttsResult.audio_base64);
      } else {
        if (window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
          
          return new Promise((resolve) => {
            utterance.onend = resolve;
            window.speechSynthesis.speak(utterance);
          });
        }
      }
    } catch (error) {
      console.error('TTS failed:', error);
    } finally {
      setIsSpeaking(false);
      setVoiceState(VOICE_STATES.IDLE);
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setVoiceState(VOICE_STATES.RECORDING);
      setRecordingDuration(0);
      
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      await audioService.startRecording();
      console.log('Recording started');
    } catch (error) {
      console.error('Recording failed:', error);
      setVoiceState(VOICE_STATES.ERROR);
      stopRecording();
    }
  };

  const stopRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }

      const audioBlob = await audioService.stopRecording();
      
      setIsRecording(false);
      setVoiceState(VOICE_STATES.PROCESSING);
      
      if (audioBlob) {
        const base64Audio = await audioService.blobToBase64(audioBlob);
        await transcribeAudio(base64Audio);
      }
      
      console.log('Recording stopped');
    } catch (error) {
      console.error('Stop recording failed:', error);
      setVoiceState(VOICE_STATES.ERROR);
    }
  };

  const transcribeAudio = async (base64Audio) => {
    try {
      setVoiceState(VOICE_STATES.PROCESSING);
      
      setTimeout(() => {
        const sampleTranscription = "This is a sample transcription. In a real app, this would use Web Speech API or another service.";
        setTranscriptionText(sampleTranscription);
        setCurrentAnswer(sampleTranscription);
        setVoiceState(VOICE_STATES.IDLE);
      }, 2000);
      
    } catch (error) {
      console.error('Transcription failed:', error);
      setVoiceState(VOICE_STATES.ERROR);
    }
  };

  const startListening = async () => {
    try {
      setIsListening(true);
      setVoiceState(VOICE_STATES.LISTENING);
      
      const transcription = await audioService.startSpeechRecognition();
      
      if (transcription) {
        setCurrentAnswer(transcription);
        setTranscriptionText(transcription);
        
        if (autoMode) {
          setTimeout(() => {
            handleSubmitAnswer();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Speech recognition failed:', error);
      setVoiceState(VOICE_STATES.ERROR);
    } finally {
      setIsListening(false);
      setVoiceState(VOICE_STATES.IDLE);
    }
  };

  const stopListening = () => {
    audioService.stopSpeechRecognition();
    setIsListening(false);
    setVoiceState(VOICE_STATES.IDLE);
  };

  const handleStartInterview = async () => {
    try {
      await startInterview();
      
      if (speakQuestions && interviewSetup.greeting) {
        await speakText(interviewSetup.greeting);
        
        setTimeout(async () => {
          const firstQuestion = getCurrentQuestionText();
          if (firstQuestion) {
            await speakText(`Question 1: ${firstQuestion}`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
    }
  };

  // =========================
  // FIXED SUBMIT FUNCTIONS
  // =========================

  const handleSubmitAnswer = async () => {
    try {
      console.log('handleSubmitAnswer called:', { 
        showFollowUp, 
        answer: answer.trim(), 
        followUpAnswer: followUpAnswer.trim() 
      });

      if (showFollowUp) {
        // Submitting follow-up answer
        console.log('Submitting follow-up answer:', followUpAnswer);
        
        if (!followUpAnswer.trim()) {
          alert('Please provide an answer to the follow-up question.');
          return;
        }
        
        const result = await submitFollowUp();
        console.log('Follow-up result:', result);
        
        if (result) {
          // Follow-up completed successfully - no feedback speech needed
          // Move to next question after follow-up
          setTimeout(() => {
            handleNextQuestion();
          }, 1000);
        }
      } else {
        // Submitting main answer
        console.log('Submitting main answer:', answer);
        
        if (!answer.trim()) {
          alert('Please provide an answer before submitting.');
          return;
        }
        
        const result = await submitAnswer();
        console.log('Main answer result:', result);

        if (result) {
          // Check if follow-up was triggered
          console.log('Checking for follow-up after submission:', { 
            showFollowUp, 
            followUpQuestion,
            needsFollowup: result.needs_followup 
          });

          // Wait a longer time for state to update, then check for follow-up
          setTimeout(async () => {
            console.log('Follow-up check after timeout:', { showFollowUp, followUpQuestion });
            
            if (showFollowUp && followUpQuestion) {
              // Follow-up was triggered, speak only the clean follow-up question
              if (speakQuestions) {
                const cleanQuestion = extractFollowUpQuestion(followUpQuestion);
                console.log('Speaking follow-up question:', cleanQuestion);
                await speakText(cleanQuestion);
              }
              // Don't move to next question automatically - wait for user to answer follow-up
            } else {
              // No follow-up, move to next question
              setTimeout(() => {
                handleNextQuestion();
              }, 1000);
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Answer submission failed:', error);
      alert('Failed to submit answer. Please try again.');
    }
  };

  const handleNextQuestion = async () => {
    console.log('handleNextQuestion called:', { currentQuestion, totalQuestions: questions.length });
    
    if (isLastQuestion()) {
      await handleCompleteInterview();
    } else {
      nextQuestion();
      
      if (speakQuestions) {
        setTimeout(async () => {
          const nextQuestionText = getCurrentQuestionText();
          if (nextQuestionText) {
            await speakText(`Question ${currentQuestion + 2}: ${nextQuestionText}`);
          }
        }, 1000);
      }
    }
  };

  const handleCompleteInterview = async () => {
    try {
      const result = await completeInterview();
      
      if (speakQuestions) {
        await speakText("Thank you for completing the interview. Your responses have been recorded and will be reviewed shortly.");
      }
      
      onComplete?.(result);
    } catch (error) {
      console.error('Interview completion failed:', error);
    }
  };

  const clearTimers = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    if (speechTimeout.current) {
      clearTimeout(speechTimeout.current);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVoiceStateColor = () => {
    switch (voiceState) {
      case VOICE_STATES.RECORDING:
        return GRADIENTS.recording;
      case VOICE_STATES.LISTENING:
        return GRADIENTS.transcribing;
      case VOICE_STATES.SPEAKING:
        return GRADIENTS.speaking;
      case VOICE_STATES.PROCESSING:
        return GRADIENTS.transcribing;
      case VOICE_STATES.ERROR:
        return GRADIENTS.warning;
      default:
        return GRADIENTS.idle;
    }
  };

  // =========================
  // RENDER PERMISSIONS SCREEN
  // =========================

  if (showPermissions) {
    return (
      <div style={{
        minHeight: '100vh',
        background: GRADIENTS.main,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#374151' }}>
            Audio & Video Permissions
          </h2>
          
          <p style={{ marginBottom: '30px', color: '#6b7280' }}>
            This interview requires microphone access for voice recording and optional screen sharing for monitoring.
          </p>
          
          <div style={{ marginBottom: '30px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '15px',
              background: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <span>Microphone Access</span>
              <span style={{ 
                color: audioPermission ? '#10b981' : '#6b7280',
                fontWeight: 'bold'
              }}>
                {audioPermission ? 'Granted' : 'Required'}
              </span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '15px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <span>Screen Sharing</span>
              <span style={{ 
                color: screenPermission ? '#10b981' : '#6b7280',
                fontWeight: 'bold'
              }}>
                {screenPermission === null ? 'Optional' : screenPermission ? 'Granted' : 'Denied'}
              </span>
            </div>
          </div>
          
          <button
            onClick={requestPermissions}
            style={{
              background: GRADIENTS.interview,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '15px'
            }}
          >
            Grant Permissions & Start Interview
          </button>
          
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Back to Selection
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // RENDER INTERVIEW SETUP
  // =========================

  if (interviewState === INTERVIEW_STATES.NOT_STARTED || interviewState === INTERVIEW_STATES.SETUP) {
    return (
      <div style={{
        minHeight: '100vh',
        background: GRADIENTS.interview,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <h2>Ready to Begin Interview</h2>
          <p style={{ marginBottom: '30px', color: '#6b7280' }}>
            {interviewSetup?.greeting || 'Welcome to your AI interview!'}
          </p>
          
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={speakQuestions}
                onChange={(e) => setSpeakQuestions(e.target.checked)}
                style={{ marginRight: '10px' }}
              />
              Enable voice prompts
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                style={{ marginRight: '10px' }}
              />
              Auto-submit answers after speech
            </label>
          </div>
          
          <button
            onClick={handleStartInterview}
            disabled={loading}
            style={{
              background: GRADIENTS.success,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Starting...' : 'Start Interview'}
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // RENDER MAIN INTERVIEW - FIXED
  // =========================

  return (
    <div style={{
      minHeight: '100vh',
      background: GRADIENTS.interview,
      padding: '20px'
    }}>
      {/* Progress Bar */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '10px',
        height: '8px',
        marginBottom: '20px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: GRADIENTS.success,
          height: '100%',
          width: `${getInterviewProgress()}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Main Interview Area */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '30px'
        }}>
          {/* DEBUG INFO */}
          <div style={{
            background: '#f0f9ff',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            DEBUG: showFollowUp={showFollowUp ? 'true' : 'false'}, 
            followUpQuestion="{followUpQuestion}", 
            currentQuestion={currentQuestion}
          </div>

          {/* Question - SHOWS FOLLOW-UP IN MAIN AREA */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#374151', marginBottom: '10px' }}>
              {getQuestionNumber()}
              {showFollowUp && (
                <span style={{ 
                  background: '#fef3c7', 
                  color: '#92400e', 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  marginLeft: '10px' 
                }}>
                  Follow-up
                </span>
              )}
            </h3>
            <p style={{ 
              fontSize: '18px', 
              lineHeight: '1.6',
              color: '#1f2937',
              background: showFollowUp ? '#fef3c7' : '#f8fafc',
              padding: '20px',
              borderRadius: '8px',
              border: showFollowUp ? '2px solid #fbbf24' : '1px solid #e2e8f0'
            }}>
              {getDisplayQuestion() || 'Loading question...'}
            </p>
          </div>

          {/* Answer Input - HANDLES BOTH MAIN AND FOLLOW-UP */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '10px', 
              fontWeight: 'bold',
              color: '#374151'
            }}>
              {showFollowUp ? 'Your Follow-up Answer:' : 'Your Answer:'}
            </label>
            <textarea
              value={getCurrentAnswer()}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={getPlaceholder()}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '15px',
                border: showFollowUp ? '2px solid #fbbf24' : '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: showFollowUp ? '#fefcf2' : 'white'
              }}
            />
          </div>

          {/* Voice Controls */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isListening || isSpeaking}
              style={{
                background: isRecording ? GRADIENTS.warning : GRADIENTS.ready,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isRecording ? `Stop (${formatTime(recordingDuration)})` : 'Record'}
            </button>

            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isRecording || isSpeaking}
              style={{
                background: isListening ? GRADIENTS.transcribing : GRADIENTS.ready,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isListening ? 'Stop Listening' : 'Voice Recognition'}
            </button>
          </div>

          {/* Submit Button - HANDLES BOTH MAIN AND FOLLOW-UP */}
          <button
            onClick={handleSubmitAnswer}
            disabled={loading || !getCurrentAnswer().trim()}
            style={{
              background: GRADIENTS.success,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: loading || !getCurrentAnswer().trim() ? 0.7 : 1
            }}
          >
            {loading ? 'Submitting...' : showFollowUp ? 'Submit Follow-up Answer' : 'Submit Answer'}
          </button>

          {/* Remove Feedback Display - User doesn't want to see feedback points */}
        </div>

        {/* Status Panel */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          height: 'fit-content'
        }}>
          <h4 style={{ marginBottom: '20px', color: '#374151' }}>Interview Status</h4>
          
          {/* Voice State Indicator */}
          <div style={{
            background: getVoiceStateColor(),
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>
              {voiceState === VOICE_STATES.RECORDING && '🎙️'}
              {voiceState === VOICE_STATES.LISTENING && '👂'}
              {voiceState === VOICE_STATES.SPEAKING && '🗣️'}
              {voiceState === VOICE_STATES.PROCESSING && '⚙️'}
              {voiceState === VOICE_STATES.IDLE && '😊'}
              {voiceState === VOICE_STATES.ERROR && '❌'}
            </div>
            <div style={{ fontWeight: 'bold' }}>
              {voiceState.charAt(0).toUpperCase() + voiceState.slice(1)}
            </div>
          </div>

          {/* Progress Info */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Progress:</span>
              <span>{getInterviewProgress()}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Question:</span>
              <span>{currentQuestion + 1}/{questions.length}</span>
            </div>
            {showFollowUp && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '5px',
                color: '#92400e',
                fontWeight: 'bold'
              }}>
                <span>Follow-up:</span>
                <span>Active</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setSpeakQuestions(!speakQuestions)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: speakQuestions ? '#e0f2fe' : 'white',
                cursor: 'pointer'
              }}
            >
              Voice Prompts: {speakQuestions ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setAutoMode(!autoMode)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: autoMode ? '#e0f2fe' : 'white',
                cursor: 'pointer'
              }}
            >
              Auto Mode: {autoMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Back Button */}
          <button
            onClick={onBack}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ← Back to Selection
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '15px',
          maxWidth: '300px',
          color: '#b91c1c'
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default Interview;