import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Hook that runs a callback when the screen comes into focus
 */
export function useOnFocus(callback: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      callback();
    }, [callback])
  );
}

/**
 * Hook that returns a debounced version of the callback
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return useCallback(
    (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}