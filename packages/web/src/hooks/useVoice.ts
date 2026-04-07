// ============================================================
// useVoice — Browser Voice Input (STT) + Output (TTS) Hook
// ============================================================

import { useState, useRef, useCallback } from 'react';

const API_BASE = '';

interface UseVoiceOptions {
  /** Language hint for STT (e.g. 'vi', 'en'). Defaults to browser locale */
  language?: string;
  /** Max recording duration in ms. Default 60000 (1 minute) */
  maxDuration?: number;
  /** Callback when transcription completes */
  onTranscript?: (text: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

interface UseVoiceReturn {
  /** Whether the user is currently recording */
  isRecording: boolean;
  /** Whether transcription is in progress */
  isTranscribing: boolean;
  /** Whether TTS is currently speaking */
  isSpeaking: boolean;
  /** Last transcribed text */
  transcript: string;
  /** Current recording duration in seconds */
  recordingDuration: number;
  /** Start recording audio from microphone */
  startRecording: () => Promise<void>;
  /** Stop recording and send for transcription */
  stopRecording: () => void;
  /** Speak text using browser SpeechSynthesis */
  speak: (text: string, voice?: string) => void;
  /** Stop speaking */
  stopSpeaking: () => void;
  /** Cancel recording without transcribing */
  cancelRecording: () => void;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { language, maxDuration = 60000, onTranscript, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecordingDuration(0);
  }, []);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      if (language) formData.append('language', language);

      const token = localStorage.getItem('hitechclaw_token');
      const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = await res.json();
      const text = data.text || '';
      setTranscript(text);
      onTranscript?.(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      onError?.(msg);
    } finally {
      setIsTranscribing(false);
    }
  }, [language, onTranscript, onError]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        if (blob.size > 0) {
          transcribeAudio(blob);
        }
      };

      recorder.start(250); // collect data every 250ms
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration timer
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      // Max duration safety
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, maxDuration);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      onError?.(msg);
    }
  }, [maxDuration, cleanup, transcribeAudio, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
  }, [cleanup]);

  // ─── TTS via SpeechSynthesis ──────────────────────────────

  const speak = useCallback((text: string, voice?: string) => {
    if (!('speechSynthesis' in window)) {
      onError?.('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language || navigator.language;

    if (voice) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === voice || v.lang.startsWith(voice));
      if (match) utterance.voice = match;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [language, onError]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    transcript,
    recordingDuration,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    cancelRecording,
  };
}
