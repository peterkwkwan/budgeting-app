import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { RecurringRow } from '@/components/RecurringRow';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useRecurringList } from '@/hooks/useRecurring';

/**
 * Manage recurring rules (stack screen — not a bottom tab).
 * Create new rules via Ledger → Add → Repeat.
 */
export default function RecurringManageScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useRecurringList();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Recurring rules' }} />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <TitleText style={styles.emptyTitle}>Couldn’t load rules</TitleText>
          <CaptionText style={styles.emptyBody}>
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </CaptionText>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={() => void refetch()}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <CaptionText style={styles.hint}>
              To add a new repeat, use Ledger → Add → Repeat. Tap a rule below to
              edit future entries or stop the series.
            </CaptionText>
          }
          renderItem={({ item }) => (
            <RecurringRow
              series={item}
              onPress={() => router.push(`/recurring/${item.id}`)}
            />
          )}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={
            (data?.length ?? 0) === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <TitleText style={styles.emptyTitle}>No recurring rules</TitleText>
              <CaptionText style={styles.emptyBody}>
                From Ledger, tap Add and choose Repeat beside the date. Fudget
                fills matching ledger entries for the next 90 days.
              </CaptionText>
              <Pressable
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.secondaryPressed,
                ]}
                onPress={() => router.push('/transaction/new')}
              >
                <CaptionText style={styles.secondaryText}>
                  Add transaction
                </CaptionText>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.green[50],
  },
  hint: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    color: colors.inkMuted,
  },
  list: {
    paddingBottom: space.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  empty: {
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.green[950],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  secondary: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
