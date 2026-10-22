import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import type { TrendPoint } from '@/lib/stats';

type Props = {
  data: TrendPoint[];
  emptyLabel: string;
  strokeColor?: string;
};

const CHART_H = 160;
const CHART_W = 320;
const PAD_X = 8;
const PAD_Y = 12;
const STROKE = 2.5;

/**
 * View-only trend polyline (rotated segments + dots).
 * No Skia / SVG — stays within the M1 Dev Client native set.
 */
export function TrendLineChart({
  data,
  emptyLabel,
  strokeColor = colors.green[700],
}: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  const values = data.map((p) => p.total);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const span = maxV - minV || 1;

  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y * 2;

  const points = values.map((v, i) => {
    const x =
      PAD_X +
      (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    const y = PAD_Y + (1 - (v - minV) / span) * plotH;
    return { x, y };
  });

  const zeroY =
    minV < 0 && maxV > 0
      ? PAD_Y + (1 - (0 - minV) / span) * plotH
      : null;

  return (
    <View style={styles.wrap} accessibilityLabel="Spending trend chart">
      <View style={styles.canvas}>
        {zeroY != null ? (
          <View style={[styles.baseline, { top: zeroY }]} />
        ) : null}

        {points.slice(0, -1).map((a, i) => {
          const b = points[i + 1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <View
              key={`seg-${i}`}
              style={[
                styles.segment,
                {
                  width: length,
                  height: STROKE,
                  left: midX - length / 2,
                  top: midY - STROKE / 2,
                  backgroundColor: strokeColor,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {points.map((p, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.dot,
              {
                left: p.x - 4,
                top: p.y - 4,
                backgroundColor: strokeColor,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: CHART_W,
    height: CHART_H,
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: PAD_X,
    right: PAD_X,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.green[200],
  },
  segment: {
    position: 'absolute',
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  empty: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  emptyText: {
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
