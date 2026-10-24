import { useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import {
  formatCompactUsd,
  niceAxisTicks,
  tickDomain,
} from '@/lib/money';
import type { ProjectionPoint } from '@/lib/plannerMath';

type Props = {
  data: ProjectionPoint[];
  /** Flat horizontal target (goal mode only). */
  targetAmount?: number | null;
  emptyLabel: string;
};

const CHART_H = 176;
/** Thin left pad so compact Y labels (`$1.0M`) sit inset; plot still reads edge-to-edge. */
const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_Y = 16;
const STROKE = 2.5;
const DOT = 8;
const DASH_W = 5;
const DASH_GAP = 4;
const Y_LABEL_W = 42;

/**
 * Style B projection: solid curve, soft green area fill, light grid with
 * compact Y ticks, start/end dots, optional flat dotted target line.
 * View-only — no Skia / Victory. Canvas width follows parent (full-bleed).
 */
export function ProjectionChart({
  data,
  targetAmount = null,
  emptyLabel,
}: Props) {
  // Full-bleed ≈ window width; onLayout corrects if insets differ.
  const [chartW, setChartW] = useState(
    () => Dimensions.get('window').width
  );

  function onWrapLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== chartW) setChartW(w);
  }

  if (data.length === 0) {
    return (
      <View style={styles.empty} onLayout={onWrapLayout}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  const values = data.map((p) => p.netWorth);
  const target =
    targetAmount != null && Number.isFinite(targetAmount)
      ? targetAmount
      : null;
  const dataMin = Math.min(...values, target ?? values[0]!, 0);
  const dataMax = Math.max(...values, target ?? values[0]!, 0);
  const ticks = niceAxisTicks(dataMin, dataMax, 4);
  const { min: minV, max: maxV } = tickDomain(ticks, dataMin, dataMax);
  const span = maxV - minV || 1;
  const plotW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const plotH = CHART_H - PAD_Y * 2;
  const lastMonth = data[data.length - 1]?.month ?? 1;

  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;

  const points = values.map((v, i) => {
    const month = data[i]!.month;
    const x =
      PAD_LEFT +
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
    for (let x = PAD_LEFT; x < PAD_LEFT + plotW; x += DASH_W + DASH_GAP) {
      dashes.push({
        left: x,
        width: Math.min(DASH_W, PAD_LEFT + plotW - x),
      });
    }
  }

  return (
    <View
      style={styles.wrap}
      onLayout={onWrapLayout}
      accessibilityLabel="Planner projection chart"
    >
      <View style={[styles.canvas, { width: chartW }]}>
        {/* Compact Y ticks + aligned grid */}
        {ticks.map((tick, i) => {
          const y = yFor(tick);
          return (
            <View key={`tick-${i}`}>
              <CaptionText
                style={[
                  styles.yLabel,
                  {
                    top: y - 7,
                    width: Y_LABEL_W,
                  },
                ]}
                numberOfLines={1}
              >
                {formatCompactUsd(tick)}
              </CaptionText>
              <View style={[styles.gridLine, { top: y }]} />
            </View>
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

        {/* Flat dotted target (goal mode) — same scale as ticks */}
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
      <View style={[styles.axisRow, { width: chartW }]}>
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
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  canvas: {
    width: '100%',
    height: CHART_H,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    // Full-bleed: square to screen edges (no side gutters / radius).
    borderRadius: 0,
  },
  yLabel: {
    position: 'absolute',
    left: 2,
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'right',
  },
  gridLine: {
    position: 'absolute',
    left: PAD_LEFT,
    right: PAD_RIGHT,
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
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: PAD_LEFT,
    paddingRight: PAD_RIGHT,
    marginTop: space.xs,
  },
  axis: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  targetHint: {
    color: colors.green[400],
    fontSize: 11,
    lineHeight: 14,
  },
  empty: {
    width: '100%',
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
