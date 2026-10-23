import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import type { ProjectionPoint } from '@/lib/plannerMath';

type Marker = {
  month: number;
  label: string;
};

type Props = {
  data: ProjectionPoint[];
  markers?: Marker[];
  emptyLabel: string;
};

const CHART_H = 168;
const CHART_W = 320;
const PAD_X = 8;
const PAD_Y = 14;
const STROKE = 2.5;

/**
 * View-only net-worth projection polyline (same approach as Stats TrendLineChart).
 * Goal markers are vertical ticks — no Skia / Victory.
 */
export function ProjectionChart({
  data,
  markers = [],
  emptyLabel,
}: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  const values = data.map((p) => p.netWorth);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const span = maxV - minV || 1;
  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y * 2;
  const lastMonth = data[data.length - 1]?.month ?? 1;

  const points = values.map((v, i) => {
    const month = data[i]!.month;
    const x =
      PAD_X +
      (lastMonth === 0 ? plotW / 2 : (month / lastMonth) * plotW);
    const y = PAD_Y + (1 - (v - minV) / span) * plotH;
    return { x, y };
  });

  const zeroY =
    minV < 0 && maxV > 0
      ? PAD_Y + (1 - (0 - minV) / span) * plotH
      : null;

  // Downsample segments for long horizons (keep chart light)
  const step = points.length > 60 ? Math.ceil(points.length / 48) : 1;
  const drawn = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  return (
    <View style={styles.wrap} accessibilityLabel="Planner projection chart">
      <View style={styles.canvas}>
        {zeroY != null ? (
          <View style={[styles.baseline, { top: zeroY }]} />
        ) : null}

        {markers.map((m) => {
          if (m.month < 0 || m.month > lastMonth) return null;
          const x =
            PAD_X +
            (lastMonth === 0 ? plotW / 2 : (m.month / lastMonth) * plotW);
          return (
            <View
              key={`m-${m.month}-${m.label}`}
              style={[styles.marker, { left: x - 1 }]}
              accessibilityLabel={`Goal marker ${m.label}`}
            />
          );
        })}

        {drawn.slice(0, -1).map((a, i) => {
          const b = drawn[i + 1]!;
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
                  backgroundColor: colors.green[700],
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {drawn
          .filter((_, i) => i === 0 || i === drawn.length - 1 || i % 4 === 0)
          .map((p, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                {
                  left: p.x - 3.5,
                  top: p.y - 3.5,
                  backgroundColor: colors.green[700],
                },
              ]}
            />
          ))}
      </View>
      <View style={styles.axisRow}>
        <CaptionText style={styles.axis}>Now</CaptionText>
        <CaptionText style={styles.axis}>
          {lastMonth >= 12
            ? `${Math.round(lastMonth / 12)}y`
            : `${lastMonth}mo`}
        </CaptionText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
  marker: {
    position: 'absolute',
    top: PAD_Y,
    bottom: PAD_Y,
    width: 2,
    backgroundColor: colors.green[400],
    opacity: 0.85,
  },
  segment: {
    position: 'absolute',
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  axisRow: {
    width: CHART_W,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_X,
    marginTop: space.xs,
  },
  axis: {
    color: colors.inkMuted,
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
