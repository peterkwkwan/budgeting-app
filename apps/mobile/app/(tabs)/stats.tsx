import { useNavigation } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  MonthCardPager,
  type MonthCardSlot,
} from '@/components/MonthCardPager';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { StatsMonthBody } from '@/components/stats/StatsMonthBody';
import { CaptionText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colors, fonts, radius, space } from '@/constants/theme';
import {
  useAdjacentStatsMonthsReady,
  usePrefetchAdjacentStatsMonths,
} from '@/hooks/useMonthPrefetch';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePartnerLink } from '@/hooks/usePartner';
import { type StatsScope } from '@/hooks/useStats';
import { useAuth } from '@/lib/auth';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import {
  PeriodNavHeader,
  periodNavScreenOptions,
} from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  shiftPeriodFocus,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import { STATS_PERSONAL_OFFLINE_BANNER } from '@/lib/offline/ux';
import type { StatsMetric } from '@/lib/stats';

export default function StatsScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { formatWhole } = useFormatMoney();
  const formatSigned = useCallback(
    (n: number): string => {
      const sign = n < 0 ? '−' : '';
      return `${sign}${formatWhole(Math.abs(n))}`;
    },
    [formatWhole]
  );
  const timeZone = profile?.timezone || 'UTC';
  const partnerLink = usePartnerLink();
  const { offline, pairStatsBlocked } = useOfflineGates();
  const isPaired = partnerLink.data?.status === 'active';

  const [scope, setScope] = useState<StatsScope>('personal');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [pieType, setPieType] = useState<TransactionType>('expense');
  const [trendMetric, setTrendMetric] = useState<StatsMetric>('expense');

  // Shared with PeriodSelector so the header month tracks the card swipe.
  const swipeTranslateX = useSharedValue(0);
  const swipePagerWidth = useSharedValue(0);
  const [monthNavLocked, setMonthNavLocked] = useState(false);

  // Unlink → Pair scope disappears immediately; fall back to personal.
  useEffect(() => {
    if (!isPaired && scope === 'pair') {
      setScope('personal');
    }
  }, [isPaired, scope]);

  const period = useMemo(
    () =>
      resolvePeriodBounds(preset, timeZone, {
        focus,
        customStart: preset === 'custom' ? customStart : undefined,
        customEndInclusive: preset === 'custom' ? customEnd : undefined,
      }),
    [preset, timeZone, focus, customStart, customEnd]
  );

  const prevMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', -1),
    [focus.year, focus.month]
  );
  const nextMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', 1),
    [focus.year, focus.month]
  );
  const prevNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: prevMonthFocus }).navLabel,
    [timeZone, prevMonthFocus.year, prevMonthFocus.month]
  );
  const nextNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: nextMonthFocus }).navLabel,
    [timeZone, nextMonthFocus.year, nextMonthFocus.month]
  );

  const swipeMotion = useMemo(
    () =>
      preset === 'month'
        ? {
            translateX: swipeTranslateX,
            pagerWidth: swipePagerWidth,
            prevLabel: prevNavLabel,
            nextLabel: nextNavLabel,
          }
        : null,
    [
      preset,
      swipeTranslateX,
      swipePagerWidth,
      prevNavLabel,
      nextNavLabel,
    ]
  );

  useLayoutEffect(() => {
    navigation.setOptions(
      periodNavScreenOptions(() => (
        <PeriodNavHeader>
          <PeriodSelector
            preset={preset}
            navLabel={period.navLabel}
            focus={focus}
            timeZone={timeZone}
            customStart={customStart}
            customEnd={customEnd}
            showModeMenu
            swipeMotion={swipeMotion}
            monthNavLocked={monthNavLocked}
            onPresetChange={setPreset}
            onFocusChange={setFocus}
            onCustomStartChange={(date) => {
              setCustomStart(date);
              setCustomEnd((end) =>
                date.getTime() > end.getTime() ? date : end
              );
            }}
            onCustomEndChange={(date) => {
              setCustomEnd(date);
              setCustomStart((start) =>
                date.getTime() < start.getTime() ? date : start
              );
            }}
          />
        </PeriodNavHeader>
      ))
    );
  }, [
    navigation,
    preset,
    period.navLabel,
    focus,
    timeZone,
    customStart,
    customEnd,
    swipeMotion,
    monthNavLocked,
  ]);

  const showPair = scope === 'pair' && isPaired;
  const pairLive = showPair && !pairStatsBlocked;
  const pairBlocked = showPair && pairStatsBlocked;

  // Warm M±1 / M±2 so rapid swipes hit cache (skeleton only past the window).
  usePrefetchAdjacentStatsMonths({
    focus,
    timeZone,
    pieType,
    pairLive,
    trendMetric,
    enabled: preset === 'month',
  });

  const neighborsReady = useAdjacentStatsMonthsReady({
    focus,
    timeZone,
    pairLive,
    enabled: preset === 'month',
  });

  const goToThisMonth = useCallback(() => {
    setPreset('month');
    setFocus(currentPeriodFocus(timeZone));
  }, [timeZone]);

  const onMonthStep = useCallback((delta: -1 | 1) => {
    setFocus((current) => shiftPeriodFocus(current, 'month', delta));
  }, []);

  const onPartnerRefetch = useCallback(() => {
    void partnerLink.refetch();
  }, [partnerLink]);

  const renderPage = useCallback(
    (pageFocus: PeriodFocus, slot: MonthCardSlot) => (
      <StatsMonthBody
        focus={pageFocus}
        preset={preset}
        timeZone={timeZone}
        pieType={pieType}
        onPieTypeChange={setPieType}
        trendMetric={trendMetric}
        onTrendMetricChange={setTrendMetric}
        pairLive={pairLive}
        pairBlocked={pairBlocked}
        offline={offline}
        partnerRefetching={partnerLink.isRefetching}
        partnerLoading={partnerLink.isLoading}
        onPartnerRefetch={onPartnerRefetch}
        formatSigned={formatSigned}
        active={slot === 'current'}
        onGoToThisMonth={goToThisMonth}
        customStart={customStart}
        customEnd={customEnd}
      />
    ),
    [
      preset,
      timeZone,
      pieType,
      trendMetric,
      pairLive,
      pairBlocked,
      offline,
      partnerLink.isRefetching,
      partnerLink.isLoading,
      onPartnerRefetch,
      formatSigned,
      goToThisMonth,
      customStart,
      customEnd,
    ]
  );

  return (
    <View style={styles.container}>
      <OfflineBanner
        message={offline ? STATS_PERSONAL_OFFLINE_BANNER : null}
      />

      {isPaired ? (
        <View style={styles.scopeRowPad}>
          <View style={styles.scopeRow}>
            {(
              [
                { value: 'personal', label: 'Personal' },
                { value: 'pair', label: 'Pair' },
              ] as const
            ).map((opt) => {
              const selected = scope === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setScope(opt.value)}
                  style={[
                    styles.scopeChip,
                    selected && styles.scopeChipSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label} stats`}
                >
                  <CaptionText
                    style={[
                      styles.scopeText,
                      selected && styles.scopeTextSelected,
                    ]}
                  >
                    {opt.label}
                  </CaptionText>
                </Pressable>
              );
            })}
          </View>
          {pairLive ? (
            <CaptionText style={styles.pairHint}>
              Combined totals with{' '}
              {partnerLink.data?.partnerDisplayName ?? 'partner'}. Category sums
              only — no individual transactions.
            </CaptionText>
          ) : null}
        </View>
      ) : null}

      <MonthCardPager
        focus={focus}
        enabled={preset === 'month'}
        onStep={onMonthStep}
        renderPage={renderPage}
        translateX={swipeTranslateX}
        pagerWidth={swipePagerWidth}
        neighborsReady={neighborsReady}
        onInputLockChange={setMonthNavLocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scopeRowPad: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  scopeChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.surface,
  },
  scopeText: {
    color: colors.inkMuted,
  },
  scopeTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  pairHint: {
    color: colors.inkMuted,
  },
});
