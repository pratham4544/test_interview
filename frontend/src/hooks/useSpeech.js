import { useState, useCallback } from 'react';
import audioService from '../services/audioService';

export const useSpeech = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const startListening = useCallback(async () => {
    try {
      setIsListening(true);
      setError(null);
      
      const result = await audioService.startSpeechRecognition();
      setTranscript(result);
      setIsListening(false);
      
      return result;
    } catch (err) {
      setError(err.message);
      setIsListening(false);
      throw err;
    }
  }, []);

  const stopListening = useCallback(() => {
    audioService.stopSpeechRecognition();
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript
  };
};