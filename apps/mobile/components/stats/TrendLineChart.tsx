import { useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { BodyText, CaptionText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import {
  formatCompactUsd,
  niceAxisTicks,
  tickDomain,
} from '@/lib/money';
import {
  formatTrendBucketLabel,
  type TrendBucket,
} from '@/lib/periods';
import type { TrendPoint } from '@/lib/stats';

type Props = {
  data: TrendPoint[];
  emptyLabel: string;
  bucket: TrendBucket;
  timeZone: string;
  strokeColor?: string;
};

const CHART_H = 176;
const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_Y = 16;
const STROKE = 2.5;
const DOT = 8;
const GHOST_DOT = 7;
const Y_LABEL_W = 42;
/** Max X tick labels so dense day series stay readable. */
const MAX_X_LABELS = 5;

/** Exact copy for <2 Trend points (ghost-line placeholder). */
const INSUFFICIENT_COPY =
  'Not enough data points to display a trend line. Add more transactions to see a pattern across more than one period.';

/**
 * Ghost continuation after a single real point (normalized 0–1 in plot box).
 * First entry is the real point (leftish); rest are faint future ghosts.
 */
const INSUFFICIENT_LAYOUT = [
  { x: 0.18, y: 0.32 },
  { x: 0.42, y: 0.4 },
  { x: 0.66, y: 0.26 },
  { x: 0.9, y: 0.35 },
] as const;

const DASH_LEN = 5;
const DASH_GAP = 6;
const GHOST_STROKE = 2;

/**
 * View-only trend polyline with labeled axes (rotated segments + dots).
 * No Skia / SVG — stays within the M1 Dev Client native set.
 */
export function TrendLineChart({
  data,
  emptyLabel,
  bucket,
  timeZone,
  strokeColor = colors.green[700],
}: Props) {
  const [chartW, setChartW] = useState(
    () => Dimensions.get('window').width - space.md * 2
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

  // One bucket (or otherwise <2 points) cannot form a trend line.
  if (data.length < 2) {
    return (
      <InsufficientTrendPlaceholder
        point={data[0]!}
        bucket={bucket}
        timeZone={timeZone}
        strokeColor={strokeColor}
        chartW={chartW}
        onWrapLayout={onWrapLayout}
      />
    );
  }

  const values = data.map((p) => p.total);
  const dataMin = Math.min(...values, 0);
  const dataMax = Math.max(...values, 0);
  const ticks = niceAxisTicks(dataMin, dataMax, 4);
  const { min: minV, max: maxV } = tickDomain(ticks, dataMin, dataMax);
  const span = maxV - minV || 1;

  const plotW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const plotH = CHART_H - PAD_Y * 2;

  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;

  const points = values.map((v, i) => {
    const x =
      PAD_LEFT +
      (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    return { x, y: yFor(v) };
  });

  const zeroY = minV < 0 && maxV > 0 ? yFor(0) : null;

  const xLabelIndexes = pickLabelIndexes(data.length, MAX_X_LABELS);

  return (
    <View
      style={styles.wrap}
      onLayout={onWrapLayout}
      accessibilityLabel="Spending trend chart"
    >
      <View style={[styles.canvas, { width: chartW }]}>
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

        {zeroY != null ? (
          <View
            style={[
              styles.baseline,
              { top: zeroY, left: PAD_LEFT, right: PAD_RIGHT },
            ]}
          />
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
                left: p.x - DOT / 2,
                top: p.y - DOT / 2,
                backgroundColor: strokeColor,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.axisRow, { width: chartW }]}>
        {xLabelIndexes.map((idx) => {
          const point = points[idx]!;
          const label = formatTrendBucketLabel(
            data[idx]!.bucketStart,
            bucket,
            timeZone
          );
          return (
            <CaptionText
              key={`x-${idx}`}
              style={[
                styles.xLabel,
                {
                  left: Math.max(
                    PAD_LEFT,
                    Math.min(point.x - 28, chartW - PAD_RIGHT - 56)
                  ),
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </CaptionText>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Solid single point + dashed ghost future line + explanatory copy.
 * No CTA — totals / categories / metric toggles stay on the parent screen.
 */
function InsufficientTrendPlaceholder({
  point,
  bucket,
  timeZone,
  strokeColor,
  chartW,
  onWrapLayout,
}: {
  point: TrendPoint;
  bucket: TrendBucket;
  timeZone: string;
  strokeColor: string;
  chartW: number;
  onWrapLayout: (e: LayoutChangeEvent) => void;
}) {
  const dataMin = Math.min(point.total, 0);
  const dataMax = Math.max(point.total, 0);
  const ticks = niceAxisTicks(dataMin, dataMax, 3);
  const { min: minV, max: maxV } = tickDomain(ticks, dataMin, dataMax);
  const span = maxV - minV || 1;

  const plotW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const plotH = CHART_H - PAD_Y * 2;
  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;

  // Layout uses fixed ghost y offsets; real point y follows the value.
  const realY = yFor(point.total);
  const layoutPts = INSUFFICIENT_LAYOUT.map((p, i) => ({
    x: PAD_LEFT + p.x * plotW,
    y: i === 0 ? realY : PAD_Y + p.y * plotH,
  }));
  const real = layoutPts[0]!;
  const ghostPts = layoutPts.slice(1);

  const xLabels = layoutPts.map((_, i) =>
    formatTrendBucketLabel(
      advanceBucketStart(point.bucketStart, bucket, i),
      bucket,
      timeZone
    )
  );

  return (
    <View
      style={styles.wrap}
      onLayout={onWrapLayout}
      accessibilityLabel={INSUFFICIENT_COPY}
      accessibilityRole="text"
    >
      <View style={styles.insufficientFrame}>
        <View style={[styles.canvas, { width: chartW }]}>
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
                <View
                  style={[
                    styles.gridLine,
                    { top: y },
                    i !== ticks.length - 1 && styles.gridLineDashedHint,
                  ]}
                />
              </View>
            );
          })}

          {/* Dashed ghost continuation from the real point through future ghosts */}
          {layoutPts.slice(0, -1).map((a, i) => (
            <DashedSegment
              key={`ghost-seg-${i}`}
              from={a}
              to={layoutPts[i + 1]!}
              color={colors.border}
            />
          ))}

          {ghostPts.map((p, i) => (
            <View
              key={`ghost-dot-${i}`}
              style={[
                styles.ghostDot,
                {
                  left: p.x - GHOST_DOT / 2,
                  top: p.y - GHOST_DOT / 2,
                },
              ]}
            />
          ))}

          <View
            style={[
              styles.dot,
              {
                left: real.x - DOT / 2,
                top: real.y - DOT / 2,
                backgroundColor: strokeColor,
              },
            ]}
          />
        </View>

        <View style={[styles.axisRow, { width: chartW }]}>
          {layoutPts.map((p, i) => (
            <CaptionText
              key={`x-insuff-${i}`}
              style={[
                styles.xLabel,
                i === 0 ? styles.xLabelReal : styles.xLabelGhost,
                {
                  left: Math.max(
                    PAD_LEFT,
                    Math.min(p.x - 28, chartW - PAD_RIGHT - 56)
                  ),
                },
              ]}
              numberOfLines={1}
            >
              {xLabels[i]}
            </CaptionText>
          ))}
        </View>

        <BodyText style={styles.insufficientCopy}>{INSUFFICIENT_COPY}</BodyText>
      </View>
    </View>
  );
}

/** Advance a trend bucket start by `steps` periods (UTC calendar math). */
function advanceBucketStart(
  bucketStartIso: string,
  bucket: TrendBucket,
  steps: number
): string {
  if (steps === 0) return bucketStartIso;
  const d = new Date(bucketStartIso);
  if (Number.isNaN(d.getTime())) return bucketStartIso;
  if (bucket === 'year') {
    d.setUTCFullYear(d.getUTCFullYear() + steps);
  } else if (bucket === 'month') {
    d.setUTCMonth(d.getUTCMonth() + steps);
  } else if (bucket === 'week') {
    d.setUTCDate(d.getUTCDate() + 7 * steps);
  } else {
    d.setUTCDate(d.getUTCDate() + steps);
  }
  return d.toISOString();
}

/** Short dashes along a line segment (View-only; no SVG). */
function DashedSegment({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return null;

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const ux = dx / length;
  const uy = dy / length;
  const step = DASH_LEN + DASH_GAP;
  const dashes: { x: number; y: number; w: number }[] = [];

  for (let d = 0; d < length; d += step) {
    const w = Math.min(DASH_LEN, length - d);
    const cx = from.x + ux * (d + w / 2);
    const cy = from.y + uy * (d + w / 2);
    dashes.push({ x: cx, y: cy, w });
  }

  return (
    <>
      {dashes.map((dash, i) => (
        <View
          key={`d-${i}`}
          style={[
            styles.ghostDash,
            {
              width: dash.w,
              left: dash.x - dash.w / 2,
              top: dash.y - GHOST_STROKE / 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      ))}
    </>
  );
}

/** Evenly spaced indexes including first and last. */
function pickLabelIndexes(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const n = Math.min(maxLabels, count);
  if (n === 2) return [0, count - 1];
  const indexes: number[] = [];
  for (let i = 0; i < n; i++) {
    indexes.push(Math.round((i * (count - 1)) / (n - 1)));
  }
  return [...new Set(indexes)];
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
  gridLineDashedHint: {
    opacity: 0.55,
  },
  baseline: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.green[200],
  },
  segment: {
    position: 'absolute',
    borderRadius: 2,
  },
  ghostDash: {
    position: 'absolute',
    height: GHOST_STROKE,
    borderRadius: 1,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  ghostDot: {
    position: 'absolute',
    width: GHOST_DOT,
    height: GHOST_DOT,
    borderRadius: GHOST_DOT / 2,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  axisRow: {
    position: 'relative',
    height: 20,
    marginTop: space.xs,
  },
  xLabel: {
    position: 'absolute',
    top: 0,
    width: 56,
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  xLabelReal: {
    color: colors.inkMuted,
  },
  xLabelGhost: {
    color: colors.border,
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
  insufficientFrame: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 4,
    paddingTop: space.md,
    paddingBottom: space.md,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  insufficientCopy: {
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
