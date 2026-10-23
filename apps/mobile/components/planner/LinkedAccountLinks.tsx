import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, fonts } from '@/constants/theme';

export type LinkedAccountRef = { id: string; name: string };

type Props = {
  accounts: LinkedAccountRef[];
  /** Prefix before the names, e.g. "Linked accounts:" or "Progress from linked accounts:" */
  label: string;
  onPressAccount: (id: string) => void;
  /** Append a period after the last name (detail copy). */
  trailingPeriod?: boolean;
};

/**
 * “Linked accounts: Name, Name” with each name as an accent link → account edit.
 */
export function LinkedAccountLinks({
  accounts,
  label,
  onPressAccount,
  trailingPeriod = false,
}: Props) {
  if (accounts.length === 0) return null;

  return (
    <View style={styles.row}>
      <CaptionText style={styles.muted}>{label} </CaptionText>
      {accounts.map((a, i) => (
        <View key={a.id} style={styles.nameChunk}>
          {i > 0 ? <CaptionText style={styles.muted}>, </CaptionText> : null}
          <Pressable
            onPress={() => onPressAccount(a.id)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel={`Edit account ${a.name}`}
          >
            <CaptionText style={styles.link}>{a.name}</CaptionText>
          </Pressable>
        </View>
      ))}
      {trailingPeriod ? <CaptionText style={styles.muted}>.</CaptionText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  nameChunk: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muted: { color: colors.inkMuted },
  link: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    textDecorationLine: 'underline',
  },
});
