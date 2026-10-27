import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  useAccountBackupStatus,
  useDeleteMyAccount,
  useRestoreMyData,
  useWipeMyData,
} from '@/hooks/useAccountBackup';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { NEEDS_INTERNET_COPY, UNSYNCED_DISCARD_COPY } from '@/lib/offline/ux';
import { useAuth } from '@/lib/auth';
import {
  DELETE_CONFIRM_PHRASE,
  WIPE_CONFIRM_PHRASE,
  formatBackupDeadline,
  matchesConfirmPhrase,
} from '@/lib/accountData';

type ConfirmKind = 'wipe' | 'restore' | 'delete' | null;

/**
 * Settings → Danger zone: Wipe my data (30-day restore), Restore, Delete account.
 */
export function AccountDangerZone() {
  const { signOut } = useAuth();
  const backupQuery = useAccountBackupStatus();
  const wipe = useWipeMyData();
  const restore = useRestoreMyData();
  const deleteAccount = useDeleteMyAccount();
  const { accountDataBlocked, outboxPending } = useOfflineGates();

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const backup = backupQuery.data;
  const restoreAvailable = Boolean(backup?.restoreAvailable && backup.expiresAt);
  const expiresLabel = formatBackupDeadline(backup?.expiresAt);
  const wipedLabel = formatBackupDeadline(backup?.wipedAt);

  const busy =
    wipe.isPending || restore.isPending || deleteAccount.isPending;

  const closeConfirm = (opts?: { force?: boolean }) => {
    if (busy && !opts?.force) return;
    setConfirmKind(null);
    setTyped('');
    setError(null);
  };

  const openConfirm = (kind: ConfirmKind) => {
    if (accountDataBlocked) return;
    setError(null);
    setTyped('');
    setConfirmKind(kind);
  };

  const onConfirm = () => {
    if (confirmKind === 'wipe') {
      if (!matchesConfirmPhrase(typed, WIPE_CONFIRM_PHRASE)) {
        setError(`Type ${WIPE_CONFIRM_PHRASE} to confirm.`);
        return;
      }
      wipe.mutate(undefined, {
        onSuccess: () => {
          closeConfirm({ force: true });
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Wipe failed.');
        },
      });
      return;
    }

    if (confirmKind === 'restore') {
      restore.mutate(undefined, {
        onSuccess: () => {
          closeConfirm({ force: true });
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Restore failed.');
        },
      });
      return;
    }

    if (confirmKind === 'delete') {
      if (!matchesConfirmPhrase(typed, DELETE_CONFIRM_PHRASE)) {
        setError(`Type ${DELETE_CONFIRM_PHRASE} to confirm.`);
        return;
      }
      deleteAccount.mutate(undefined, {
        onSuccess: () => {
          closeConfirm({ force: true });
          void signOut();
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : 'Could not delete account.'
          );
        },
      });
    }
  };

  const confirmTitle =
    confirmKind === 'wipe'
      ? 'Wipe my data?'
      : confirmKind === 'restore'
        ? 'Restore my data?'
        : confirmKind === 'delete'
          ? 'Delete my account?'
          : '';

  const confirmBody =
    confirmKind === 'wipe'
      ? `This clears transactions, recurring rules, Planner, and unlinks your partner. You stay signed in. You can restore for 30 days, then the backup is permanently deleted.${
          outboxPending ? ` ${UNSYNCED_DISCARD_COPY}` : ''
        }`
      : confirmKind === 'restore'
        ? `Bring back data from the wipe on ${wipedLabel}. Anything you created after the wipe will be discarded and cannot be recovered.`
        : confirmKind === 'delete'
          ? 'This permanently deletes your Fudget account and all data, including any wipe backup. This cannot be undone. You will be signed out.'
          : '';

  const confirmNeedsPhrase =
    confirmKind === 'wipe' || confirmKind === 'delete';
  const confirmPhrase =
    confirmKind === 'wipe'
      ? WIPE_CONFIRM_PHRASE
      : confirmKind === 'delete'
        ? DELETE_CONFIRM_PHRASE
        : '';

  const confirmActionLabel =
    confirmKind === 'wipe'
      ? 'Wipe my data'
      : confirmKind === 'restore'
        ? 'Restore and replace'
        : confirmKind === 'delete'
          ? 'Delete account forever'
          : 'Confirm';

  return (
    <View style={styles.block}>
      <CaptionText style={styles.label}>Danger zone</CaptionText>
      <StrongText style={styles.blockTitle}>Account data</StrongText>
      <CaptionText style={styles.hint}>
        Wipe clears your data but keeps you signed in. Delete removes your
        Google account link and all Fudget data forever.
      </CaptionText>
      {accountDataBlocked ? (
        <CaptionText style={styles.hint}>{NEEDS_INTERNET_COPY}</CaptionText>
      ) : null}

      {restoreAvailable ? (
        <View style={styles.notice}>
          <StrongText style={styles.noticeTitle}>
            Restore until {expiresLabel}
          </StrongText>
          <CaptionText style={styles.noticeBody}>
            You wiped on {wipedLabel}. Restore brings that backup back and
            discards anything added since.
          </CaptionText>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.dangerBtn,
          pressed && !accountDataBlocked && styles.dangerBtnPressed,
          (busy || accountDataBlocked) && styles.disabled,
        ]}
        onPress={() => openConfirm('wipe')}
        disabled={busy || accountDataBlocked}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || accountDataBlocked }}
        accessibilityLabel="Wipe my data"
      >
        <StrongText style={styles.dangerBtnText}>Wipe my data</StrongText>
        <CaptionText style={styles.dangerBtnMeta}>
          Clear product data · 30-day restore
        </CaptionText>
      </Pressable>

      {restoreAvailable ? (
        <Pressable
          style={({ pressed }) => [
            styles.restoreBtn,
            pressed && !accountDataBlocked && styles.restoreBtnPressed,
            (busy || accountDataBlocked) && styles.disabled,
          ]}
          onPress={() => openConfirm('restore')}
          disabled={busy || accountDataBlocked}
          accessibilityRole="button"
          accessibilityLabel="Restore my data"
        >
          <StrongText style={styles.restoreBtnText}>Restore my data</StrongText>
          <CaptionText style={styles.restoreBtnMeta}>
            Available until {expiresLabel}
          </CaptionText>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.deleteBtn,
          pressed && !accountDataBlocked && styles.deleteBtnPressed,
          (busy || accountDataBlocked) && styles.disabled,
        ]}
        onPress={() => openConfirm('delete')}
        disabled={busy || accountDataBlocked}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
      >
        <StrongText style={styles.deleteBtnText}>Delete my account</StrongText>
        <CaptionText style={styles.deleteBtnMeta}>
          Authentication + all data
        </CaptionText>
      </Pressable>

      <Modal
        visible={confirmKind != null}
        transparent
        animationType="fade"
        onRequestClose={() => closeConfirm()}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => closeConfirm()}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <StrongText style={styles.modalTitle}>{confirmTitle}</StrongText>
            <CaptionText style={styles.modalBody}>{confirmBody}</CaptionText>

            {confirmNeedsPhrase ? (
              <View style={styles.confirmField}>
                <CaptionText style={styles.confirmLabel}>
                  Type {confirmPhrase} to confirm
                </CaptionText>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder={confirmPhrase}
                  placeholderTextColor={colors.inkMuted}
                  style={styles.input}
                  accessibilityLabel={`Type ${confirmPhrase} to confirm`}
                />
              </View>
            ) : null}

            {error ? (
              <CaptionText style={styles.errorText}>{error}</CaptionText>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.cancelBtnPressed,
                ]}
                onPress={() => closeConfirm()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <StrongText style={styles.cancelBtnText}>Cancel</StrongText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  confirmKind === 'restore'
                    ? styles.confirmBtnRestore
                    : styles.confirmBtnDanger,
                  pressed && styles.confirmBtnPressed,
                  busy && styles.disabled,
                ]}
                onPress={onConfirm}
                disabled={busy || accountDataBlocked}
                accessibilityRole="button"
                accessibilityLabel={confirmActionLabel}
              >
                {busy ? (
                  <ActivityIndicator color={colors.inkInverse} />
                ) : (
                  <StrongText style={styles.confirmBtnText}>
                    {confirmActionLabel}
                  </StrongText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  blockTitle: {
    color: colors.danger,
  },
  hint: {
    color: colors.inkMuted,
    marginBottom: space.xs,
  },
  notice: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.green[50],
    padding: space.sm,
    gap: space.xs,
  },
  noticeTitle: {
    color: colors.green[950],
  },
  noticeBody: {
    color: colors.inkMuted,
  },
  dangerBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.xs,
  },
  dangerBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dangerBtnText: {
    color: colors.danger,
  },
  dangerBtnMeta: {
    color: colors.inkMuted,
  },
  restoreBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
    padding: space.md,
    gap: space.xs,
  },
  restoreBtnPressed: {
    backgroundColor: colors.green[200],
  },
  restoreBtnText: {
    color: colors.green[700],
  },
  restoreBtnMeta: {
    color: colors.inkMuted,
  },
  deleteBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: space.md,
    gap: space.xs,
  },
  deleteBtnPressed: {
    backgroundColor: colors.border,
  },
  deleteBtnText: {
    color: colors.danger,
  },
  deleteBtnMeta: {
    color: colors.inkMuted,
  },
  disabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: space.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.canvas,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
  },
  modalBody: {
    color: colors.inkMuted,
  },
  confirmField: {
    gap: space.xs,
  },
  confirmLabel: {
    color: colors.inkMuted,
  },
  input: {
    ...typography.body,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.danger,
  },
  modalActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cancelBtnText: {
    color: colors.ink,
  },
  confirmBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  confirmBtnDanger: {
    backgroundColor: colors.danger,
  },
  confirmBtnRestore: {
    backgroundColor: colors.green[700],
  },
  confirmBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  confirmBtnText: {
    color: colors.inkInverse,
    textAlign: 'center',
  },
});
