import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoreIcon, TrashIcon } from '@/components/icons';
import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';

type Props = {
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onOverflow: () => void;
};

/**
 * Transactions edit/selection mode header: Cancel · N selected · trash · ⋮
 * Replaces the month period header while selection is active.
 */
export function TxnSelectionHeader({
  count,
  busy = false,
  onCancel,
  onDelete,
  onOverflow,
}: Props) {
  const insets = useSafeAreaInsets();
  const label = count === 1 ? '1 selected' : `${count} selected`;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, space.sm),
          backgroundColor: colors.canvas,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={onCancel}
          disabled={busy}
          hitSlop={8}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel selection"
        >
          <CaptionText style={styles.cancelText}>Cancel</CaptionText>
        </Pressable>

        <StrongText style={styles.count} numberOfLines={1}>
          {label}
        </StrongText>

        <View style={styles.actions}>
          <Pressable
            onPress={onDelete}
            disabled={busy || count === 0}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.pressed,
              (busy || count === 0) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
          >
            <TrashIcon color={colors.danger} size={22} />
          </Pressable>
          <Pressable
            onPress={onOverflow}
            disabled={busy || count === 0}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.pressed,
              (busy || count === 0) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="More bulk actions"
          >
            <MoreIcon color={colors.ink} size={22} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    minHeight: 44,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  cancelBtn: {
    paddingVertical: space.xs,
    paddingRight: space.sm,
  },
  cancelText: {
    color: colors.green[700],
  },
  count: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
