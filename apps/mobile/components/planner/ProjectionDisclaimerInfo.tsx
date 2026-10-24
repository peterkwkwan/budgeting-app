import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { BodyText, CaptionText, StrongText } from '@/components/StyledText';
import { DISCLAIMER } from '@/constants/planner';
import { colors, fonts, radius, space } from '@/constants/theme';

const TIP_W = 280;

/**
 * Tiny (i) beside Projection — tap toggles a light disclaimer popover.
 * Keeps “Not financial advice” off the top of the Planner screen.
 */
export function ProjectionDisclaimerInfo() {
  const [open, setOpen] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number }>({
    top: 80,
    left: space.md,
  });
  const triggerRef = useRef<ComponentRef<typeof View>>(null);

  const openTip = useCallback(() => {
    const winW = Dimensions.get('window').width;
    const node = triggerRef.current as
      | (ComponentRef<typeof View> & {
          measureInWindow?: (
            cb: (x: number, y: number, width: number, height: number) => void
          ) => void;
        })
      | null;
    if (!node?.measureInWindow) {
      setTipPos({ top: 80, left: space.md });
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, _w, height) => {
      const left = Math.max(
        space.md,
        Math.min(x - 8, winW - TIP_W - space.md)
      );
      setTipPos({ top: y + height + 8, left });
      setOpen(true);
    });
  }, []);

  const closeTip = useCallback(() => setOpen(false), []);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={open ? closeTip : openTip}
          style={({ pressed }) => [
            styles.trigger,
            open && styles.triggerOpen,
            pressed && styles.triggerPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="About these projections"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
        >
          <CaptionText
            style={[styles.triggerGlyph, open && styles.triggerGlyphOpen]}
          >
            !
          </CaptionText>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeTip}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeTip}
            accessibilityRole="button"
            accessibilityLabel="Dismiss disclaimer"
          />
          <View
            style={[styles.tip, { top: tipPos.top, left: tipPos.left }]}
            accessibilityRole="summary"
            accessibilityLabel="About these projections"
          >
            <View style={styles.tipHead}>
              <StrongText style={styles.tipTitle}>
                About these projections
              </StrongText>
              <Pressable
                onPress={closeTip}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <CaptionText style={styles.tipClose}>×</CaptionText>
              </Pressable>
            </View>
            <BodyText style={styles.tipBody}>{DISCLAIMER}</BodyText>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.25,
    borderColor: colors.inkMuted,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerOpen: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  triggerPressed: {
    opacity: 0.85,
  },
  triggerGlyph: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyStrong,
    fontSize: 10,
    lineHeight: 12,
  },
  triggerGlyphOpen: {
    color: colors.green[700],
  },
  backdrop: {
    flex: 1,
  },
  tip: {
    position: 'absolute',
    width: TIP_W,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.chromeBorder,
    borderRadius: radius.lg - 4,
    paddingHorizontal: space.sm + 6,
    paddingVertical: space.sm + 4,
    gap: space.sm,
  },
  tipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  tipTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  tipClose: {
    color: colors.inkMuted,
    fontSize: 18,
    lineHeight: 20,
  },
  tipBody: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
