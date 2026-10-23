import { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { PlusIcon } from '@/components/icons';
import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';

/** Near-white empty fill — matches Goals/Accounts dashed CTAs. */
const EMPTY_FILL = '#fafafa';

const WELL_H = 180;
const CHART_H = 120;
const PAD = 16;
const GHOST_STROKE = 2;
/** Fallback until onLayout measures the full-bleed well. */
const FALLBACK_CHART_W = 300;

/** Soft upward curve control points (normalized 0–1 in plot box). */
const GHOST_POINTS = [
  { x: 0, y: 0.78 },
  { x: 0.22, y: 0.68 },
  { x: 0.45, y: 0.52 },
  { x: 0.68, y: 0.34 },
  { x: 1, y: 0.18 },
];

type Props = {
  onPress: () => void;
};

/**
 * H2 hybrid empty projection: faint dashed upward trend + centered plus CTA.
 * Entire well navigates to Add account. Stretches with full-bleed parent.
 */
export function ProjectionEmptyWell({ onPress }: Props) {
  const [chartW, setChartW] = useState(FALLBACK_CHART_W);

  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== chartW) setChartW(w);
  }

  const plotW = chartW - PAD * 2;
  const plotH = CHART_H - PAD * 2;
  const pts = GHOST_POINTS.map((p) => ({
    x: PAD + p.x * plotW,
    y: PAD + p.y * plotH,
  }));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.well,
        pressed && styles.wellPressed,
      ]}
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel="Add an account to see your projection"
    >
      <View
        style={[styles.ghostCanvas, { width: chartW }]}
        pointerEvents="none"
      >
        {pts.slice(0, -1).map((a, i) => {
          const b = pts[i + 1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          // Dashed look: short segment with gaps via opacity strips
          return (
            <View
              key={`g-${i}`}
              style={[
                styles.ghostSeg,
                {
                  width: length,
                  left: midX - length / 2,
                  top: midY - GHOST_STROKE / 2,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.cta} pointerEvents="none">
        <View style={styles.plusCircle}>
          <PlusIcon color={colors.green[700]} size={22} />
        </View>
        <CaptionText style={styles.caption}>
          Add an account to see your projection
        </CaptionText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  well: {
    width: '100%',
    minHeight: WELL_H,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    // Full-bleed: square to screen edges.
    borderRadius: 0,
    backgroundColor: EMPTY_FILL,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  wellPressed: {
    backgroundColor: colors.green[50],
    borderColor: colors.green[200],
  },
  ghostCanvas: {
    position: 'absolute',
    height: CHART_H,
    opacity: 0.35,
  },
  ghostSeg: {
    position: 'absolute',
    height: GHOST_STROKE,
    borderRadius: 1,
    // Soft green dashed feel via lighter stroke + opacity on parent
    backgroundColor: colors.green[400],
    borderStyle: 'dashed',
  },
  cta: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    zIndex: 1,
  },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.green[700],
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
