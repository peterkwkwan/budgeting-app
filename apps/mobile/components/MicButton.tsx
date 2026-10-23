import { Pressable, StyleSheet } from 'react-native';

import { MicIcon } from '@/components/icons';
import { colors, radius } from '@/constants/theme';

type Props = {
  listening: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Add Transaction mic: idle = canvas + green.700 border + filled green mic;
 * listening = solid green.700 + white icon.
 */
export function MicButton({ listening, onPress, disabled }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        listening ? styles.listening : styles.idle,
        (pressed || disabled) && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        listening ? 'Stop listening' : 'Fill with voice'
      }
      accessibilityState={{ disabled: !!disabled, selected: listening }}
    >
      <MicIcon
        size={22}
        color={listening ? colors.inkInverse : colors.green[700]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  idle: {
    backgroundColor: colors.canvas,
    borderColor: colors.green[700],
  },
  listening: {
    backgroundColor: colors.green[700],
    borderColor: colors.green[700],
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
