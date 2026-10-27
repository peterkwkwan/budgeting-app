import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText } from '@/components/StyledText';
import {
  ACCOUNT_CURRENCIES,
  currencyPickerLabel,
  type AccountCurrency,
} from '@/constants/currencies';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { invalidateAllProductQueries } from '@/hooks/useAccountBackup';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import {
  currencyConvertHint,
  offlineUxKeys,
  SYNC_BEFORE_CONVERT_COPY,
} from '@/lib/offline/ux';
import { profileCurrency, setAccountCurrency } from '@/lib/currency';
import { formatFxRateInput, suggestFxRate } from '@/lib/fx';
import { parseMoneyInput } from '@/lib/money';

/**
 * Settings → Currency: pick account currency; Keep amounts or Convert with rate.
 */
export default function CurrencySettingsScreen() {
  const router = useRouter();
  const { profile, refreshProfile, user } = useAuth();
  const queryClient = useQueryClient();
  const { edges, scrollProps } = useScrollEdges();
  const { manageBlocked, offline, outboxPending } = useOfflineGates();
  const currencyHint = currencyConvertHint({
    enabled: OFFLINE_TXNS_ENABLED,
    online: !offline,
    outboxPending,
  });
  const current = profileCurrency(profile);

  const [pending, setPending] = useState<AccountCurrency | null>(null);
  const [rateText, setRateText] = useState('');
  const [fxHint, setFxHint] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeSheet = useCallback(() => {
    if (busy) return;
    setPending(null);
    setRateText('');
    setFxHint(null);
    setError(null);
  }, [busy]);

  useEffect(() => {
    if (!pending || pending === current) return;
    let cancelled = false;
    setFxLoading(true);
    setFxHint(null);
    setRateText('');
    void suggestFxRate(current, pending).then((result) => {
      if (cancelled) return;
      setFxLoading(false);
      if (result.ok) {
        setRateText(formatFxRateInput(result.rate));
        setFxHint(
          result.source === 'cache'
            ? 'Suggested from a recent rate — you can edit it.'
            : 'Suggested today’s rate — you can edit it.'
        );
      } else {
        setFxHint(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pending, current]);

  const onPick = (code: AccountCurrency) => {
    if (manageBlocked || code === current) return;
    setError(null);
    setPending(code);
  };

  const apply = async (mode: 'keep' | 'convert') => {
    if (mode === 'convert' && outboxPending) {
      setError(SYNC_BEFORE_CONVERT_COPY);
      return;
    }
    if (!pending || manageBlocked) return;
    setError(null);
    let rate: number | null = null;
    if (mode === 'convert') {
      rate = parseMoneyInput(rateText);
      if (!(rate > 0) || Number.isNaN(rate)) {
        setError('Enter a rate greater than zero, or keep amounts as-is.');
        return;
      }
    }
    setBusy(true);
    try {
      await setAccountCurrency({
        newCurrency: pending,
        mode,
        rate,
      });
      await refreshProfile();
      if (mode === 'convert' && OFFLINE_TXNS_ENABLED && user?.id) {
        try {
          const { resetLocalAndFullPull } = await import('@/lib/offline/syncEngine');
          await resetLocalAndFullPull(user.id);
        } catch (err) {
          console.warn('[offline] re-pull after convert failed', err);
        }
      }
      invalidateAllProductQueries(queryClient);
      if (OFFLINE_TXNS_ENABLED) {
        void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
      }
      setPending(null);
      setRateText('');
      setFxHint(null);
      setError(null);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update currency.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Currency' }} />
      <ScrollEdgeHost edges={edges} style={styles.host}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          <View style={styles.block}>
            <CaptionText style={styles.label}>Account currency</CaptionText>
            <StrongText style={styles.blockTitle}>{current}</StrongText>
            <CaptionText style={styles.hint}>
              All amounts use one currency. Changing it can keep numbers as-is
              or convert them with a rate you choose.
            </CaptionText>
            {currencyHint ? (
              <CaptionText style={styles.hint}>{currencyHint}</CaptionText>
            ) : null}
          </View>

          <View style={styles.block}>
            <CaptionText style={styles.label}>Choose currency</CaptionText>
            {ACCOUNT_CURRENCIES.map((code) => {
              const selected = code === current;
              return (
                <Pressable
                  key={code}
                  onPress={() => onPick(code)}
                  disabled={manageBlocked}
                  style={[
                    styles.row,
                    selected && styles.rowSelected,
                    manageBlocked && styles.rowDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: manageBlocked }}
                >
                  <StrongText
                    style={[styles.rowText, selected && styles.rowTextSelected]}
                  >
                    {currencyPickerLabel(code)}
                  </StrongText>
                  {selected ? (
                    <CaptionText style={styles.currentBadge}>Current</CaptionText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ScrollEdgeHost>

      <Modal
        visible={pending != null}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            <StrongText style={styles.sheetTitle}>
              Change to {pending}?
            </StrongText>
            <CaptionText style={styles.sheetBody}>
              Keep amounts as-is only changes the currency label. Convert
              updates every transaction, recurring rule, and Planner money field.
              Convert is hard to undo — restore from a wipe backup if you need
              to reverse it.
            </CaptionText>

            {pending ? (
              <View style={styles.rateBlock}>
                <CaptionText style={styles.rateLabel}>
                  1 {current} = ___ {pending}
                </CaptionText>
                {fxLoading ? (
                  <ActivityIndicator color={colors.green[700]} />
                ) : (
                  <TextInput
                    value={rateText}
                    onChangeText={setRateText}
                    keyboardType="decimal-pad"
                    placeholder="Rate"
                    placeholderTextColor={colors.inkMuted}
                    style={styles.rateInput}
                    editable={!busy}
                  />
                )}
                {fxHint ? (
                  <CaptionText style={styles.fxHint}>{fxHint}</CaptionText>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <CaptionText style={styles.error}>{error}</CaptionText>
            ) : null}

            <Pressable
              style={[
                styles.primaryBtn,
                (busy || manageBlocked) && styles.btnDisabled,
              ]}
              disabled={busy || manageBlocked}
              onPress={() => void apply('keep')}
            >
              <StrongText style={styles.primaryBtnText}>
                Keep amounts as-is
              </StrongText>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                (busy || fxLoading || manageBlocked) && styles.btnDisabled,
              ]}
              disabled={busy || fxLoading || manageBlocked}
              onPress={() => void apply('convert')}
            >
              {busy ? (
                <ActivityIndicator color={colors.green[700]} />
              ) : (
                <StrongText style={styles.secondaryBtnText}>
                  Convert all amounts
                </StrongText>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              disabled={busy}
              onPress={closeSheet}
            >
              <CaptionText style={styles.cancelText}>Cancel</CaptionText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1, backgroundColor: colors.canvas },
  container: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  label: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  blockTitle: { color: colors.green[700] },
  hint: { color: colors.inkMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {},
  rowDisabled: { opacity: 0.55 },
  rowText: { color: colors.ink, flex: 1 },
  rowTextSelected: { color: colors.green[700] },
  currentBadge: { color: colors.inkMuted },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.ink,
  },
  sheetBody: { color: colors.inkMuted, marginBottom: space.sm },
  rateBlock: { gap: space.xs, marginBottom: space.sm },
  rateLabel: { color: colors.ink },
  rateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  fxHint: { color: colors.inkMuted },
  error: { color: colors.danger },
  primaryBtn: {
    backgroundColor: colors.green[700],
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.inkInverse },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.green[700],
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.green[700] },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: { alignItems: 'center', paddingVertical: space.sm },
  cancelText: { color: colors.inkMuted },
});
