import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { shadow } from '@/constants/theme';

const THRESHOLD = 1;

export type ScrollEdgeState = {
  top: boolean;
  bottom: boolean;
};

type ScrollMetrics = {
  y: number;
  contentH: number;
  layoutH: number;
};

function edgesFromMetrics(m: ScrollMetrics): ScrollEdgeState {
  const { y, contentH, layoutH } = m;
  if (layoutH <= 0 || contentH <= 0) {
    return { top: false, bottom: false };
  }
  const overflow = contentH > layoutH + THRESHOLD;
  if (!overflow) {
    return { top: false, bottom: false };
  }
  return {
    top: y > THRESHOLD,
    bottom: y + layoutH < contentH - THRESHOLD,
  };
}

/**
 * Tracks whether scroll content is clipped above/below the viewport so
 * {@link ScrollEdgeShadows} can show a soft edge cue.
 */
export function useScrollEdges() {
  const [edges, setEdges] = useState<ScrollEdgeState>({
    top: false,
    bottom: false,
  });
  const metrics = useRef<ScrollMetrics>({ y: 0, contentH: 0, layoutH: 0 });

  const recompute = useCallback(() => {
    const next = edgesFromMetrics(metrics.current);
    setEdges((prev) =>
      prev.top === next.top && prev.bottom === next.bottom ? prev : next
    );
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      metrics.current = {
        y: contentOffset.y,
        contentH: contentSize.height,
        layoutH: layoutMeasurement.height,
      };
      recompute();
    },
    [recompute]
  );

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      metrics.current.contentH = h;
      recompute();
    },
    [recompute]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      metrics.current.layoutH = e.nativeEvent.layout.height;
      recompute();
    },
    [recompute]
  );

  return {
    edges,
    /** Spread onto ScrollView / FlatList. */
    scrollProps: {
      onScroll,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle: 16 as const,
    },
  };
}

type ShadowsProps = ScrollEdgeState;

/**
 * Soft paper-white scroll-edge fades. Parent must be `position: 'relative'`
 * (or a flex host); place as a sibling over the scroll view.
 */
export function ScrollEdgeShadows({ top, bottom }: ShadowsProps) {
  return (
    <>
      {top ? (
        <View pointerEvents="none" style={[styles.edge, styles.top]}>
          <EdgeFade direction="down" />
        </View>
      ) : null}
      {bottom ? (
        <View pointerEvents="none" style={[styles.edge, styles.bottom]}>
          <EdgeFade direction="up" />
        </View>
      ) : null}
    </>
  );
}

/** Host that fills available space and paints edge shadows over children. */
export function ScrollEdgeHost({
  children,
  edges,
  style,
}: {
  children: ReactNode;
  edges: ScrollEdgeState;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.host, style]}>
      {children}
      <ScrollEdgeShadows top={edges.top} bottom={edges.bottom} />
    </View>
  );
}

function EdgeFade({ direction }: { direction: 'down' | 'up' }) {
  // Stacked strips approximate a soft gradient without expo-linear-gradient.
  const opacities =
    direction === 'down'
      ? [0.07, 0.045, 0.028, 0.014]
      : [0.014, 0.028, 0.045, 0.07];
  return (
    <View style={styles.fadeCol}>
      {opacities.map((opacity, i) => (
        <View
          key={i}
          style={[
            styles.fadeStrip,
            { backgroundColor: `rgba(28, 28, 30, ${opacity})` },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    position: 'relative',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: shadow.scrollEdge.height,
    zIndex: 2,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  fadeCol: {
    flex: 1,
  },
  fadeStrip: {
    flex: 1,
  },
});
