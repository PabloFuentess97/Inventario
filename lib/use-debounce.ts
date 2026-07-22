"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Devuelve una versión con debounce de la función: se ejecuta cuando pasan
 * `esperaMs` sin nuevas llamadas. Se usa para el auto-guardado sin botón.
 */
export function useDebounce<A extends unknown[]>(
  fn: (...args: A) => void,
  esperaMs = 600
): (...args: A) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(
    () =>
      (...args: A) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => fnRef.current(...args), esperaMs);
      },
    [esperaMs]
  );
}
