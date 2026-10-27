import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { PENDING_SYNC_COPY } from '@/lib/offline/ux';

/** Small amber marker for a local edit waiting on cloud sync. */
export function PendingSyncDot() {
  return (
    <View
      style={styles.dot}
      accessible
      accessibilityLabel={PENDING_SYNC_COPY}
      accessibilityRole="image"
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.rust[400],
  },
});
