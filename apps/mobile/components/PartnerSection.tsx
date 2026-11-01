import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import {
  useAcceptPartnerInvite,
  useCreatePartnerInvite,
  usePartnerLink,
  useUnlinkPartner,
} from '@/hooks/usePartner';

/**
 * Account → Partner: create/share invite code, redeem, or unlink.
 * Aggregate Stats scope appears only while status === active.
 */
export function PartnerSection() {
  const linkQuery = usePartnerLink();
  const createInvite = useCreatePartnerInvite();
  const acceptInvite = useAcceptPartnerInvite();
  const unlink = useUnlinkPartner();
  const { manageBlocked, manageHint } = useOfflineGates();
  const [codeInput, setCodeInput] = useState('');
  const [showEnterCode, setShowEnterCode] = useState(false);

  const link = linkQuery.data ?? null;
  const busy =
    createInvite.isPending || acceptInvite.isPending || unlink.isPending;
  const locked = busy || manageBlocked;

  const onShareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join me on Fudget with this invite code: ${code}`,
      });
    } catch {
      // User dismissed share sheet — ignore
    }
  };

  const onUnlink = () => {
    if (locked) return;
    const title =
      link?.status === 'pending' ? 'Cancel invite?' : 'Unlink partner?';
    const message =
      link?.status === 'pending'
        ? 'Your invite code will stop working.'
        : 'Pair stats will disappear for both of you right away. Transactions stay private.';
    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      {
        text: link?.status === 'pending' ? 'Cancel invite' : 'Unlink',
        style: 'destructive',
        onPress: () => {
          unlink.mutate(undefined, {
            onError: (err) => {
              Alert.alert(
                'Couldn’t unlink',
                err instanceof Error ? err.message : 'Try again.'
              );
            },
          });
        },
      },
    ]);
  };

  const onCreate = () => {
    if (locked) return;
    createInvite.mutate(undefined, {
      onError: (err) => {
        Alert.alert(
          'Couldn’t create invite',
          err instanceof Error ? err.message : 'Try again.'
        );
      },
    });
  };

  const onAccept = () => {
    if (locked) return;
    const code = codeInput.trim();
    if (code.length < 6) {
      Alert.alert('Enter the invite code', 'Ask your partner for their code.');
      return;
    }
    acceptInvite.mutate(code, {
      onSuccess: () => {
        setCodeInput('');
        setShowEnterCode(false);
      },
      onError: (err) => {
        Alert.alert(
          'Couldn’t accept invite',
          err instanceof Error ? err.message : 'Check the code and try again.'
        );
      },
    });
  };

  return (
    <View style={styles.section}>
      <TitleText style={styles.title}>Partner</TitleText>
      <CaptionText style={styles.blurb}>
        Pair with one other account. You’ll see combined category totals — never
        each other’s transaction notes or rows.
      </CaptionText>
      {manageHint ? (
        <CaptionText style={styles.blurb}>{manageHint}</CaptionText>
      ) : null}

      {linkQuery.isLoading ? (
        <ActivityIndicator color={colors.green[700]} />
      ) : link?.status === 'active' ? (
        <View style={styles.block}>
          <CaptionText style={styles.label}>Paired with</CaptionText>
          <StrongText style={styles.value}>
            {link.partnerDisplayName ?? 'Partner'}
          </StrongText>
          <CaptionText style={styles.meta}>
            Open Stats and switch to Pair for combined totals.
          </CaptionText>
          <Pressable
            style={({ pressed }) => [
              styles.dangerOutline,
              pressed && styles.dangerPressed,
              locked && styles.disabled,
            ]}
            onPress={onUnlink}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Unlink partner"
          >
            <CaptionText style={styles.dangerText}>Unlink</CaptionText>
          </Pressable>
        </View>
      ) : link?.status === 'pending' && link.inviteCode && !showEnterCode ? (
        <View style={styles.block}>
          <CaptionText style={styles.label}>Your invite code</CaptionText>
          <StrongText style={styles.code} accessibilityLabel={`Code ${link.inviteCode}`}>
            {link.inviteCode}
          </StrongText>
          <CaptionText style={styles.meta}>
            Share this code. It works once, for one partner. Or enter a code
            from your partner — that cancels this invite.
          </CaptionText>
          <View style={styles.rowActions}>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                locked && styles.disabled,
              ]}
              onPress={() => void onShareCode(link.inviteCode!)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="Share invite code"
            >
              <StrongText style={styles.primaryText}>Share code</StrongText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.secondaryPressed,
                locked && styles.disabled,
              ]}
              onPress={onCreate}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="Refresh invite code"
            >
              <CaptionText style={styles.secondaryText}>New code</CaptionText>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              styles.enterInstead,
              pressed && !locked && styles.secondaryPressed,
              locked && styles.disabled,
            ]}
            onPress={() => {
              if (locked) return;
              setShowEnterCode(true);
            }}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Enter a partner's invite code"
          >
            <CaptionText style={styles.secondaryText}>Enter code</CaptionText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.dangerOutline,
              pressed && styles.dangerPressed,
              locked && styles.disabled,
            ]}
            onPress={onUnlink}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="Cancel invite"
          >
            <CaptionText style={styles.dangerText}>Cancel invite</CaptionText>
          </Pressable>
        </View>
      ) : showEnterCode ? (
        <View style={styles.block}>
          <CaptionText style={styles.label}>Invite code</CaptionText>
          {link?.status === 'pending' ? (
            <CaptionText style={styles.meta}>
              Accepting a code cancels your invite.
            </CaptionText>
          ) : null}
          <TextInput
            value={codeInput}
            onChangeText={(t) => setCodeInput(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD2345"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            editable={!locked}
            accessibilityLabel="Invite code"
          />
          <View style={styles.rowActions}>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                locked && styles.disabled,
              ]}
              onPress={onAccept}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="Accept invite"
            >
              {acceptInvite.isPending ? (
                <ActivityIndicator color={colors.inkInverse} />
              ) : (
                <StrongText style={styles.primaryText}>Accept</StrongText>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.secondaryPressed,
              ]}
              onPress={() => {
                setShowEnterCode(false);
                setCodeInput('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <CaptionText style={styles.secondaryText}>Back</CaptionText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.block}>
          <CaptionText style={styles.meta}>
            Not paired yet. Create a code to share, or enter one from your
            partner.
          </CaptionText>
          <View style={styles.rowActions}>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                locked && styles.disabled,
              ]}
              onPress={onCreate}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="Create invite code"
            >
              {createInvite.isPending ? (
                <ActivityIndicator color={colors.inkInverse} />
              ) : (
                <StrongText style={styles.primaryText}>Create code</StrongText>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondary,
                pressed && !locked && styles.secondaryPressed,
                locked && styles.disabled,
              ]}
              onPress={() => {
                if (locked) return;
                setShowEnterCode(true);
              }}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="Enter invite code"
            >
              <CaptionText style={styles.secondaryText}>Enter code</CaptionText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  title: {
    color: colors.green[950],
  },
  blurb: {
    color: colors.inkMuted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
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
  value: {
    color: colors.ink,
  },
  code: {
    color: colors.green[950],
    fontFamily: fonts.bodyStrong,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 3,
  },
  meta: {
    color: colors.inkMuted,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  primary: {
    flexGrow: 1,
    minWidth: 120,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  primaryPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    color: colors.inkInverse,
    fontFamily: fonts.bodyStrong,
  },
  secondary: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  enterInstead: {
    alignSelf: 'stretch',
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  dangerOutline: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dangerText: {
    color: colors.danger,
    fontFamily: fonts.bodyStrong,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: space.md,
    color: colors.ink,
    fontFamily: fonts.bodyStrong,
    fontSize: 18,
    letterSpacing: 2,
  },
  disabled: {
    opacity: 0.55,
  },
});
