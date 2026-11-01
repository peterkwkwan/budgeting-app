import { useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { BodyText, CaptionText } from '@/components/StyledText';
import { colors, space } from '@/constants/theme';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { niceAxisTicks, tickDomain } from '@/lib/money';
import {
  formatTrendBucketLabel,
  TREND_CENTERED_POINTS,
  type TrendBucket,
  type TrendSlot,
} from '@/lib/periods';

type Props = {
  data: TrendSlot[];
  emptyLabel: string;
  bucket: TrendBucket;
  timeZone: string;
  strokeColor?: string;
};

/** Shared with Planner ProjectionChart — open / full-bleed chrome. */
const CHART_H = 176;
const PAD_RIGHT = 10;
const PAD_Y = 16;
/** Inward inset so first/last nodes are not flush to the plot edges. */
const EDGE_PAD = 12;
const STROKE = 2.5;
const DOT = 8;
const GHOST_DOT = 7;
/**
 * Compact ticks such as `HK$100k` need more than `HK$50k`.
 * 42px ellipsizes the longer label (`HK$10...`); +12px is the room
 * requested so the full number sits in the left gutter.
 */
const Y_LABEL_INSET = 2;
const Y_LABEL_W = 54;
const PAD_LEFT = Y_LABEL_INSET + Y_LABEL_W + Y_LABEL_INSET;
/** Max X tick labels so dense day series stay readable. */
const MAX_X_LABELS = 5;

/** Exact copy for <2 Trend points (ghost-line placeholder). */
const INSUFFICIENT_COPY =
  'Not enough data points to display a trend line. Add more transactions to see a pattern across more than one period.';

/**
 * Ghost y offsets (0–1 in plot box) for the not-enough-data state.
 * Five slots match the Monthly/Yearly centered window.
 */
const INSUFFICIENT_Y = [0.42, 0.3, 0.36, 0.24, 0.34] as const;

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
  const { formatCompact } = useFormatMoney();
  // Full-bleed ≈ window width; onLayout corrects if insets differ.
  const [chartW, setChartW] = useState(
    () => Dimensions.get('window').width
  );

  function onWrapLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== chartW) setChartW(w);
  }

  const realIndexes = data
    .map((p, i) => (p.total != null ? i : -1))
    .filter((i) => i >= 0);
  const realCount = realIndexes.length;

  if (data.length === 0 || realCount === 0) {
    return (
      <View style={styles.empty} onLayout={onWrapLayout}>
        <CaptionText style={styles.emptyText}>{emptyLabel}</CaptionText>
      </View>
    );
  }

  // One real bucket (or otherwise <2 points) cannot form a trend line.
  if (realCount < 2) {
    return (
      <InsufficientTrendPlaceholder
        data={data}
        bucket={bucket}
        timeZone={timeZone}
        strokeColor={strokeColor}
        chartW={chartW}
        onWrapLayout={onWrapLayout}
      />
    );
  }

  const values = realIndexes.map((i) => data[i]!.total as number);
  const dataMin = Math.min(...values, 0);
  const dataMax = Math.max(...values, 0);
  const ticks = niceAxisTicks(dataMin, dataMax, 4);
  const { min: minV, max: maxV } = tickDomain(ticks, dataMin, dataMax);
  const span = maxV - minV || 1;

  const plotW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const plotH = CHART_H - PAD_Y * 2;

  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;
  const xFor = (i: number) => plotX(i, data.length, plotW);

  type PlotPt = { x: number; y: number; index: number };
  const points: (PlotPt | null)[] = data.map((slot, i) =>
    slot.total == null
      ? null
      : { x: xFor(i), y: yFor(slot.total), index: i }
  );
  const solidPoints = points.filter((p): p is PlotPt => p != null);

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
                {formatCompact(tick)}
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

        {solidPoints.slice(0, -1).map((a, i) => {
          const b = solidPoints[i + 1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <View
              key={`seg-${a.index}-${b.index}`}
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

        {solidPoints.map((p) => (
          <View
            key={`dot-${p.index}`}
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
          const x = xFor(idx);
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
                    Math.min(x - 28, chartW - PAD_RIGHT - 56)
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
 * Solid real point(s) + dashed ghost 5-slot line + explanatory copy.
 * No CTA — totals / categories / metric toggles stay on the parent screen.
 */
function InsufficientTrendPlaceholder({
  data,
  bucket,
  timeZone,
  strokeColor,
  chartW,
  onWrapLayout,
}: {
  data: TrendSlot[];
  bucket: TrendBucket;
  timeZone: string;
  strokeColor: string;
  chartW: number;
  onWrapLayout: (e: LayoutChangeEvent) => void;
}) {
  const { formatCompact } = useFormatMoney();
  const realSlots = data.filter((p) => p.total != null);
  const anchor = realSlots[0]!;
  const dataMin = Math.min(anchor.total as number, 0);
  const dataMax = Math.max(anchor.total as number, 0);
  const ticks = niceAxisTicks(dataMin, dataMax, 3);
  const { min: minV, max: maxV } = tickDomain(ticks, dataMin, dataMax);
  const span = maxV - minV || 1;

  const plotW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const plotH = CHART_H - PAD_Y * 2;
  const yFor = (v: number) => PAD_Y + (1 - (v - minV) / span) * plotH;

  // Prefer the centered 5-slot series; fall back to synthesizing 5 labels.
  const slots =
    data.length >= TREND_CENTERED_POINTS
      ? data.slice(0, TREND_CENTERED_POINTS)
      : padInsufficientSlots(data, bucket);

  const layoutPts = slots.map((slot, i) => {
    const x = plotX(i, TREND_CENTERED_POINTS, plotW);
    if (slot.total != null) {
      return { x, y: yFor(slot.total), real: true as const };
    }
    const yNorm = INSUFFICIENT_Y[i] ?? 0.35;
    return { x, y: PAD_Y + yNorm * plotH, real: false as const };
  });

  return (
    <View
      style={styles.wrap}
      onLayout={onWrapLayout}
      accessibilityLabel={INSUFFICIENT_COPY}
      accessibilityRole="text"
    >
      {/* Open well — same chrome as the full Trend chart (no bordered card). */}
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
                {formatCompact(tick)}
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

        {layoutPts.slice(0, -1).map((a, i) => (
          <DashedSegment
            key={`ghost-seg-${i}`}
            from={a}
            to={layoutPts[i + 1]!}
            color={colors.border}
          />
        ))}

        {layoutPts.map((p, i) =>
          p.real ? (
            <View
              key={`real-dot-${i}`}
              style={[
                styles.dot,
                {
                  left: p.x - DOT / 2,
                  top: p.y - DOT / 2,
                  backgroundColor: strokeColor,
                },
              ]}
            />
          ) : (
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
          )
        )}
      </View>

      <View style={[styles.axisRow, { width: chartW }]}>
        {layoutPts.map((p, i) => (
          <CaptionText
            key={`x-insuff-${i}`}
            style={[
              styles.xLabel,
              p.real ? styles.xLabelReal : styles.xLabelGhost,
              {
                left: Math.max(
                  PAD_LEFT,
                  Math.min(p.x - 28, chartW - PAD_RIGHT - 56)
                ),
              },
            ]}
            numberOfLines={1}
          >
            {formatTrendBucketLabel(slots[i]!.bucketStart, bucket, timeZone)}
          </CaptionText>
        ))}
      </View>

      <BodyText style={styles.insufficientCopy}>{INSUFFICIENT_COPY}</BodyText>
    </View>
  );
}

/**
 * When custom Period yields a single point, invent 5 label slots by advancing
 * the bucket so the ghost layout still matches the centered window.
 */
function padInsufficientSlots(
  data: TrendSlot[],
  bucket: TrendBucket
): TrendSlot[] {
  const anchor = data.find((p) => p.total != null) ?? data[0];
  if (!anchor) {
    return Array.from({ length: TREND_CENTERED_POINTS }, () => ({
      bucketStart: new Date().toISOString(),
      total: null,
    }));
  }
  // Place the real point in the middle slot (index 2) of the 5-slot window.
  const mid = Math.floor(TREND_CENTERED_POINTS / 2);
  return Array.from({ length: TREND_CENTERED_POINTS }, (_, i) => ({
    bucketStart: advanceBucketStart(anchor.bucketStart, bucket, i - mid),
    total: i === mid ? anchor.total : null,
  }));
}

/** X inside the plot with ≥ EDGE_PAD inset on first/last nodes. */
function plotX(index: number, count: number, plotW: number): number {
  if (count <= 1) return PAD_LEFT + plotW / 2;
  const inner = Math.max(0, plotW - EDGE_PAD * 2);
  return PAD_LEFT + EDGE_PAD + (index / (count - 1)) * inner;
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
    // Full-bleed: square to screen edges (no side gutters / radius).
    borderRadius: 0,
  },
  yLabel: {
    position: 'absolute',
    left: Y_LABEL_INSET,
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
  insufficientCopy: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
