import { useState, useCallback } from 'react';

/**
 * Touch gesture hook for mobile interactions
 */
export function useTouchGestures() {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Minimum distance to be considered a swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      // Horizontal swipe
      if (isLeftSwipe) {
        console.log('Swipe left');
      } else if (isRightSwipe) {
        console.log('Swipe right');
      }
    } else {
      // Vertical swipe
      if (isUpSwipe) {
        console.log('Swipe up');
      } else if (isDownSwipe) {
        console.log('Swipe down');
      }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

/**
 * Pinch zoom hook
 */
export function usePinchZoom() {
  const [scale, setScale] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);

  const getDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialDistance(getDistance(e.touches as unknown as TouchList));
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      const newDistance = getDistance(e.touches as unknown as TouchList);
      const newScale = (newDistance / initialDistance) * scale;
      setScale(Math.min(Math.max(newScale, 0.5), 3));
    }
  }, [initialDistance, scale]);

  const onTouchEnd = useCallback(() => {
    setInitialDistance(null);
  }, []);

  const resetScale = useCallback(() => {
    setScale(1);
  }, []);

  return {
    scale,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    resetScale,
  };
}

/**
 * Double tap hook
 */
export function useDoubleTap(callback: () => void, delay = 300) {
  const [lastTap, setLastTap] = useState(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < delay) {
      callback();
    }
    setLastTap(now);
  }, [callback, delay, lastTap]);

  return handleTap;
}

/**
 * Long press hook
 */
export function useLongPress(callback: () => void, delay = 500) {
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null)[0];

  const start = useCallback(() => {
    setIsPressed(true);
    const timer = setTimeout(() => {
      callback();
      setIsPressed(false);
    }, delay);
    return timer;
  }, [callback, delay]);

  const end = useCallback(() => {
    if (timerRef) {
      clearTimeout(timerRef);
    }
    setIsPressed(false);
  }, [timerRef]);

  return {
    isPressed,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: end,
  };
}
