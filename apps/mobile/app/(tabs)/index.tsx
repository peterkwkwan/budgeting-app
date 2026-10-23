import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import { UpcomingRepeatsBar } from '@/components/UpcomingRepeatsBar';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useTransactionList } from '@/hooks/useTransactions';

export default function TransactionsScreen() {
  const router = useRouter();
  const { data, upcoming, isLoading, isError, error, refetch, isRefetching } =
    useTransactionList();

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <TitleText style={styles.emptyTitle}>
            Couldn’t load transactions
          </TitleText>
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
            upcoming ? (
              <UpcomingRepeatsBar
                summary={upcoming}
                onPress={() => router.push('/recurring')}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              onPress={() => router.push(`/transaction/${item.id}`)}
            />
          )}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={
            (data?.length ?? 0) === 0 && !upcoming
              ? styles.emptyList
              : styles.list
          }
          ListEmptyComponent={
            upcoming ? (
              <View style={styles.emptyBelowBar}>
                <CaptionText style={styles.emptyBody}>
                  No transactions for today or earlier. Upcoming repeats for
                  this month are listed above.
                </CaptionText>
              </View>
            ) : (
              <View style={styles.empty}>
                <TitleText style={styles.emptyTitle}>
                  No transactions yet
                </TitleText>
                <CaptionText style={styles.emptyBody}>
                  Tap + to add an expense or income. On the Add screen you can
                  type it, or tap the mic to speak a draft before saving. It
                  syncs for every device on this account.
                </CaptionText>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  list: {
    paddingBottom: space.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  emptyBelowBar: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
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
    borderColor: colors.border,
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
