import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText, TitleText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import type { TransactionType } from '@/constants/categories';
import { colors, space, typography } from '@/constants/theme';
import { useCategoryDrilldown } from '@/hooks/useStats';

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function CategoryDrilldownScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    type?: string;
    start?: string;
    end?: string;
    periodLabel?: string;
  }>();

  const category = asString(params.category);
  const type = (asString(params.type) || 'expense') as TransactionType;
  const startIso = asString(params.start);
  const endIso = asString(params.end);
  const periodLabel = asString(params.periodLabel);

  const start = useMemo(() => new Date(startIso), [startIso]);
  const end = useMemo(() => new Date(endIso), [endIso]);

  const boundsValid =
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    Boolean(category);

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCategoryDrilldown({
      type,
      category,
      start,
      end,
      enabled: boundsValid,
    });

  return (
    <>
      <Stack.Screen
        options={{
          title: category || 'Category',
        }}
      />
      <View style={styles.container}>
        {periodLabel ? (
          <CaptionText style={styles.period}>{periodLabel}</CaptionText>
        ) : null}

        {!boundsValid ? (
          <View style={styles.centered}>
            <TitleText style={styles.emptyTitle}>Missing filters</TitleText>
            <CaptionText style={styles.emptyBody}>
              Go back to Stats and open a category again.
            </CaptionText>
          </View>
        ) : isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.green[700]} />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <TitleText style={styles.emptyTitle}>Couldn’t load entries</TitleText>
            <CaptionText style={styles.emptyBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </CaptionText>
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TransactionRow
                transaction={item}
                onPress={() => router.push(`/transaction/${item.id}`)}
              />
            )}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            contentContainerStyle={
              (data?.length ?? 0) === 0 ? styles.emptyList : undefined
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <TitleText style={styles.emptyTitle}>No matching entries</TitleText>
                <CaptionText style={styles.emptyBody}>
                  Nothing in {category} for this period.
                </CaptionText>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  period: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    color: colors.inkMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
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
});
