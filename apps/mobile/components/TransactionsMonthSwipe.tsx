import { useCallback, useRef, type ReactNode } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import {
  MONTH_SWIPE_ACTIVATION_PX,
  MONTH_SWIPE_FAIL_Y_PX,
  monthStepFromSwipe,
} from '@/lib/monthSwipe';

type TransactionsMonthSwipeProps = {
  /** Off while selecting rows, when the month chevrons are hidden. */
  enabled: boolean;
  onStep: (delta: -1 | 1) => void;
  children: ReactNode;
};

/**
 * Horizontal swipe on the transactions body.
 * Left goes forward one month; right goes back one month.
 * Vertical drags stay with the list.
 */
export function TransactionsMonthSwipe({
  enabled,
  onStep,
  children,
}: TransactionsMonthSwipeProps) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const onDeactivate = useCallback(
    (event: { canceled: boolean; translationX: number }) => {
      if (event.canceled) return;
      const delta = monthStepFromSwipe(event.translationX);
      if (delta === 0) return;
      onStepRef.current(delta);
    },
    []
  );

  const gesture = usePanGesture({
    enabled,
    activeOffsetX: [-MONTH_SWIPE_ACTIVATION_PX, MONTH_SWIPE_ACTIVATION_PX],
    failOffsetY: [-MONTH_SWIPE_FAIL_Y_PX, MONTH_SWIPE_FAIL_Y_PX],
    runOnJS: true,
    onDeactivate,
  });

  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      {children}
    </GestureDetector>
  );
}
