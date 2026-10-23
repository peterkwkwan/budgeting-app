import { StyleSheet, View } from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import type { ProjectionPoint } from '@/lib/plannerMath';

type Props = {
  data: ProjectionPoint[];
  /** Flat horizontal target (goal mode only). */
  targetAmount?: number | null;
  emptyLabel: string;
};

const CHART_H = 176;
const CHART_W = 320;
const PAD_X = 10;
const PAD_Y = 16;
const STROKE = 2.5;
const DOT = 8;
const GRID_LINES = 3;
const DASH_W = 5;
const DASH_GAP = 4;

/**
 * Style B projection: solid curve, soft green area fill, light grid,
 * start/end dots, optional flat dotted target line (goal mode).
 * View-only — no Skia / Victory.
 */
export function ProjectionChart({
  data,
  targetAmount = null,
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
  const target =
    targetAmount != null && Number.isFinite(targetAmount)
      ? targetAmount
      : null;
  const minV = Math.min(...values, target ?? values[0]!, 0);
  const maxV = Math.max(...values, target ?? values[0]!, 0);
  const span = maxV - minV || 1;
  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y * 2;
  const lastMonth = data[data.length - 1]?.month ?? 1;

  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;

  const points = values.map((v, i) => {
    const month = data[i]!.month;
    const x =
      PAD_X +
      (lastMonth === 0 ? plotW / 2 : (month / lastMonth) * plotW);
    return { x, y: yFor(v) };
  });

  // Keep chart light on long horizons; denser than before for a smoother curve
  const step = points.length > 90 ? Math.ceil(points.length / 72) : 1;
  const drawn = points.filter(
    (_, i) => i % step === 0 || i === points.length - 1
  );

  const baselineY = PAD_Y + plotH;
  const targetY = target != null ? yFor(target) : null;

  const dashes: { left: number; width: number }[] = [];
  if (targetY != null) {
    for (let x = PAD_X; x < PAD_X + plotW; x += DASH_W + DASH_GAP) {
      dashes.push({
        left: x,
        width: Math.min(DASH_W, PAD_X + plotW - x),
      });
    }
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Planner projection chart">
      <View style={styles.canvas}>
        {/* Light horizontal grid */}
        {Array.from({ length: GRID_LINES }, (_, i) => {
          const t = (i + 1) / (GRID_LINES + 1);
          return (
            <View
              key={`grid-${i}`}
              style={[styles.gridLine, { top: PAD_Y + t * plotH }]}
            />
          );
        })}

        {/* Soft area fill under the curve */}
        {drawn.slice(0, -1).map((a, i) => {
          const b = drawn[i + 1]!;
          const left = a.x;
          const width = Math.max(1, b.x - a.x);
          const top = Math.min(a.y, b.y);
          const height = Math.max(0, baselineY - top);
          return (
            <View
              key={`fill-${i}`}
              style={[
                styles.areaStrip,
                {
                  left,
                  width,
                  top,
                  height,
                },
              ]}
            />
          );
        })}

        {/* Flat dotted target (goal mode) */}
        {targetY != null
          ? dashes.map((d, i) => (
              <View
                key={`dash-${i}`}
                style={[
                  styles.targetDash,
                  { left: d.left, width: d.width, top: targetY },
                ]}
              />
            ))
          : null}

        {/* Solid primary curve */}
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
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {/* Start + end dots only */}
        {[drawn[0], drawn[drawn.length - 1]].map((p, i) =>
          p ? (
            <View
              key={`end-${i}`}
              style={[
                styles.dot,
                {
                  left: p.x - DOT / 2,
                  top: p.y - DOT / 2,
                },
              ]}
            />
          ) : null
        )}
      </View>
      <View style={styles.axisRow}>
        <CaptionText style={styles.axis}>Now</CaptionText>
        {target != null ? (
          <CaptionText style={styles.targetHint}>Target</CaptionText>
        ) : (
          <View />
        )}
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
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  gridLine: {
    position: 'absolute',
    left: PAD_X,
    right: PAD_X,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  areaStrip: {
    position: 'absolute',
    backgroundColor: colors.green[50],
    opacity: 0.85,
  },
  targetDash: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.green[400],
    borderRadius: 1,
  },
  segment: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: colors.green[700],
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.green[700],
    borderWidth: 2,
    borderColor: colors.surface,
  },
  axisRow: {
    width: CHART_W,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD_X,
    marginTop: space.xs,
  },
  axis: {
    color: colors.inkMuted,
  },
  targetHint: {
    color: colors.green[400],
    fontSize: 12,
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
