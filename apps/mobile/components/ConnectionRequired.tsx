import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space, typography } from '@/constants/theme';

/** Centered one-line block for an online-only screen while offline. */
export function ConnectionRequired({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <CaptionText style={styles.text}>{message}</CaptionText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xxl,
    alignItems: 'center',
  },
  text: {
    color: colors.ink,
    textAlign: 'center',
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
});
