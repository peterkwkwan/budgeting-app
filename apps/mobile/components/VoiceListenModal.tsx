import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { setPendingVoiceDraft } from '@/lib/voiceDraft';
import {
  parseVoiceTranscript,
  speechContextualHints,
} from '@/lib/voiceParse';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Phase =
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

/**
 * On-device Android STT → draft → navigate to Add transaction for confirm/edit.
 * Never saves without user confirmation on the form screen.
 */
export function VoiceListenModal({ visible, onClose }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState(true);
  const finishingRef = useRef(false);

  const reset = useCallback(() => {
    finishingRef.current = false;
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
    if (!visible) {
      stopListening();
      reset();
    }
  }, [visible, stopListening, reset]);

  const finishWithTranscript = useCallback(
    (text: string) => {
      const draft = parseVoiceTranscript(text);
      if (!draft) {
        setPhase('error');
        setError(
          'Didn’t catch that. Try again, or add the transaction manually.'
        );
        return;
      }
      setPendingVoiceDraft(draft);
      stopListening();
      onClose();
      router.push('/transaction/new');
    },
    [onClose, router, stopListening]
  );

  useSpeechRecognitionEvent('start', () => {
    if (!visible) return;
    setPhase('listening');
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!visible) return;
    setPhase((p) => (p === 'listening' ? 'processing' : p));
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!visible) return;
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (text) setTranscript(text);
    if (event.isFinal && text && !finishingRef.current) {
      finishingRef.current = true;
      finishWithTranscript(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!visible || finishingRef.current) return;
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
        contextualStrings: speechContextualHints(),
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

  function handleClose() {
    stopListening();
    onClose();
  }

  const listening = phase === 'listening' || phase === 'permission';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={handleClose}
        accessibilityLabel="Dismiss voice entry"
      >
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <TitleText style={styles.title}>Speak a transaction</TitleText>
          <CaptionText style={styles.subtitle}>
            Example: “spent 24 on groceries” or “income 2000 salary”. You’ll
            check the draft before it saves.
          </CaptionText>

          {transcript ? (
            <View style={styles.transcriptBox}>
              <CaptionText style={styles.transcriptLabel}>Heard</CaptionText>
              <StrongText style={styles.transcript}>{transcript}</StrongText>
            </View>
          ) : null}

          {error ? <CaptionText style={styles.error}>{error}</CaptionText> : null}

          {phase === 'listening' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.green[700]} />
              <CaptionText style={styles.statusText}>
                Listening{onDevice ? ' (on-device)' : ''}… tap Stop when done.
              </CaptionText>
            </View>
          ) : null}
          {phase === 'permission' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.green[700]} />
              <CaptionText style={styles.statusText}>
                Checking microphone permission…
              </CaptionText>
            </View>
          ) : null}
          {phase === 'processing' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.green[700]} />
              <CaptionText style={styles.statusText}>Making a draft…</CaptionText>
            </View>
          ) : null}

          <View style={styles.actions}>
            {listening ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primary,
                  pressed && styles.primaryPressed,
                ]}
                onPress={() => {
                  try {
                    ExpoSpeechRecognitionModule.stop();
                  } catch {
                    handleClose();
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Stop listening"
              >
                <StrongText style={styles.primaryText}>Stop</StrongText>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.primary,
                  pressed && styles.primaryPressed,
                ]}
                onPress={() => void startListening()}
                accessibilityRole="button"
                accessibilityLabel="Start listening"
              >
                <StrongText style={styles.primaryText}>
                  {phase === 'error' || phase === 'unavailable'
                    ? 'Try again'
                    : 'Start listening'}
                </StrongText>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.secondaryPressed,
              ]}
              onPress={() => {
                handleClose();
                router.push('/transaction/new');
              }}
              accessibilityRole="button"
              accessibilityLabel="Enter manually"
            >
              <StrongText style={styles.secondaryText}>Enter manually</StrongText>
            </Pressable>

            <Pressable
              style={styles.cancel}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <StrongText style={{ color: colors.inkMuted }}>Cancel</StrongText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  title: {
    color: colors.green[950],
  },
  subtitle: {
    color: colors.inkMuted,
    marginBottom: space.sm,
  },
  transcriptBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: space.md,
    gap: space.xs,
  },
  transcriptLabel: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  transcript: {
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
  },
  statusText: {
    color: colors.inkMuted,
    flex: 1,
  },
  actions: {
    marginTop: space.sm,
    gap: space.sm,
  },
  primary: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    color: colors.inkInverse,
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
  secondary: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
  cancel: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
