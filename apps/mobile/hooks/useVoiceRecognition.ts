import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import {
  parseVoiceTranscript,
  speechContextualHints,
  type VoiceCategoryExtras,
  type VoiceDraft,
} from '@/lib/voiceParse';

export type VoicePhase =
  | 'idle'
  | 'permission'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unavailable';

function friendlyError(code: string, message?: string): string {
  switch (code) {
    case 'not-allowed':
      return 'Microphone permission is off. Enable it in system settings, or enter the transaction by hand.';
    case 'no-speech':
    case 'speech-timeout':
      return 'Didn’t catch that. Try again, or add the transaction manually.';
    case 'network':
      return 'Speech needs an on-device language pack (or a brief network check). Try again after installing English offline speech in system settings.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'Speech isn’t available on this device right now. Add the transaction manually.';
    case 'busy':
      return 'Speech is busy. Wait a moment and try again.';
    case 'aborted':
      return 'Listening canceled.';
    default:
      return message?.trim()
        ? message
        : 'Couldn’t use speech. Try again or enter it manually.';
  }
}

type Options = {
  /** When false, abort any in-flight recognition. */
  active?: boolean;
  /** Active custom category names (best-effort match + STT hints). */
  categoryExtras?: VoiceCategoryExtras;
  onDraft: (draft: VoiceDraft) => void;
};

/**
 * On-device Android STT → VoiceDraft. Caller confirms/edits before save.
 */
export function useVoiceRecognition({
  active = true,
  categoryExtras,
  onDraft,
}: Options) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState(true);
  const finishingRef = useRef(false);
  /** Latest interim/final text. Stop must not wait on a final event — Android often drops it. */
  const transcriptRef = useRef('');
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const extrasRef = useRef(categoryExtras);
  extrasRef.current = categoryExtras;

  const reset = useCallback(() => {
    finishingRef.current = false;
    transcriptRef.current = '';
    setPhase('idle');
    setTranscript('');
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Native module may be absent (Expo Go / web).
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopListening();
      reset();
    }
  }, [active, stopListening, reset]);

  const finishWithTranscript = useCallback((text: string) => {
    finishingRef.current = true;
    const draft = parseVoiceTranscript(text, extrasRef.current);
    // Release the recognizer. abort() drops a late final result; we already have the text.
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Native module may be absent (Expo Go / web).
    }
    if (!draft) {
      setPhase('error');
      setError(
        'Didn’t catch that. Try again, or add the transaction manually.'
      );
      return;
    }
    setPhase('idle');
    setError(null);
    setTranscript(text);
    transcriptRef.current = text;
    onDraftRef.current(draft);
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (!active) return;
    setPhase('listening');
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!active) return;
    // Session closed without a final result. Keep the interim line already on screen.
    if (!finishingRef.current && transcriptRef.current.trim()) {
      finishWithTranscript(transcriptRef.current);
      return;
    }
    setPhase((p) => (p === 'listening' || p === 'processing' ? 'idle' : p));
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!active) return;
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (text) {
      transcriptRef.current = text;
      setTranscript(text);
    }
    if (event.isFinal && text && !finishingRef.current) {
      finishWithTranscript(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!active || finishingRef.current) return;
    // On-device stop() races the recognizer and reports `client` after good partials.
    const heard = transcriptRef.current.trim();
    const lostFinal =
      event.error === 'client' ||
      event.error === 'aborted' ||
      event.error === 'no-speech' ||
      event.error === 'speech-timeout';
    if (lostFinal && heard) {
      finishWithTranscript(heard);
      return;
    }
    if (event.error === 'aborted') {
      setPhase('idle');
      return;
    }
    setPhase('error');
    setError(friendlyError(event.error, event.message));
  });

  async function startListening() {
    setError(null);
    setTranscript('');
    transcriptRef.current = '';
    finishingRef.current = false;

    if (Platform.OS !== 'android') {
      setPhase('unavailable');
      setError(
        'Voice entry is Android-only in this version. Add the transaction manually.'
      );
      return;
    }

    let available = false;
    let supportsOnDevice = false;
    try {
      available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      supportsOnDevice =
        ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      setPhase('unavailable');
      setError(
        'Voice needs a Fudget development build (not Expo Go). Rebuild with EAS profile development, then try again.'
      );
      return;
    }

    if (!available) {
      setPhase('unavailable');
      setError(
        'Speech recognition isn’t available. Install Google speech / offline English, or add the transaction manually.'
      );
      return;
    }

    setPhase('permission');
    let permission;
    try {
      permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } catch {
      setPhase('error');
      setError(
        'Couldn’t ask for microphone permission. Add the transaction manually.'
      );
      return;
    }
    if (!permission.granted) {
      setPhase('error');
      setError(friendlyError('not-allowed'));
      return;
    }

    const preferOnDevice = supportsOnDevice;
    setOnDevice(preferOnDevice);

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: preferOnDevice,
        contextualStrings: speechContextualHints(extrasRef.current),
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        },
      });
      setPhase('listening');
    } catch (err) {
      setPhase('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Couldn’t start listening. Try again or enter it manually.'
      );
    }
  }

  function toggle() {
    if (phase === 'listening' || phase === 'permission') {
      // Tap-to-stop. Commit the interim transcript now; Android often never emits isFinal.
      const heard = transcriptRef.current.trim();
      if (heard) {
        finishWithTranscript(heard);
        return;
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        stopListening();
        setPhase('idle');
      }
      return;
    }
    void startListening();
  }

  const listening = phase === 'listening' || phase === 'permission';

  return {
    phase,
    transcript,
    error,
    onDevice,
    listening,
    startListening,
    stopListening,
    toggle,
    reset,
  };
}
