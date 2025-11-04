import { useState, useCallback } from 'react';
import audioService from '../services/audioService';

export const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0);

  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      return await audioService.startRecording();
    } catch (error) {
      setIsRecording(false);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const audioBlob = await audioService.stopRecording();
      setIsRecording(false);
      return audioBlob;
    } catch (error) {
      setIsRecording(false);
      throw error;
    }
  }, []);

  const playAudio = useCallback(async (base64Audio) => {
    try {
      setIsPlaying(true);
      await audioService.playAudioFromBase64(base64Audio);
      setIsPlaying(false);
    } catch (error) {
      setIsPlaying(false);
      throw error;
    }
  }, []);

  return {
    isRecording,
    isPlaying,
    volume,
    startRecording,
    stopRecording,
    playAudio
  };
};