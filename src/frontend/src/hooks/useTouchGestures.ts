import { useState, useEffect, useCallback } from 'react';

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
        onSwipeLeft?.();
      } else if (isRightSwipe) {
        onSwipeRight?.();
      }
    } else {
      // Vertical swipe
      if (isUpSwipe) {
        onSwipeUp?.();
      } else if (isDownSwipe) {
        onSwipeDown?.();
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
 * Swipe gesture callbacks
 */
interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

/**
 * Swipe gesture hook with callbacks
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }: SwipeCallbacks) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      } else if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      } else if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    }
  }, [touchStart, touchEnd, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

/**
 * Pinch to zoom hook
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
      setInitialDistance(getDistance(e.touches));
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      const newDistance = getDistance(e.touches);
      const newScale = (newDistance / initialDistance) * scale;
      setScale(Math.min(Math.max(newScale, 0.5), 3)); // Limit scale between 0.5 and 3
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
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsPressed(true);
    timerRef.current = setTimeout(() => {
      callback();
      setIsPressed(false);
    }, delay);
  }, [callback, delay]);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isPressed,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: end,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: end,
  };
}
