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
const Y_LABEL_W = 42;
/** Max X tick labels so dense day series stay readable. */
const MAX_X_LABELS = 5;

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

  const zeroY =
    minV < 0 && maxV > 0 ? yFor(0) : null;

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
  baseline: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.green[200],
  },
  segment: {
    position: 'absolute',
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.surface,
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
