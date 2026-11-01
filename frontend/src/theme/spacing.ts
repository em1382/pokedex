/**
 * Our own spacing/padding uses Fibonacci px values (closest to the 8px-grid
 * values they replace). MUI components keep their built-in spacing.
 */
export type Fibonacci = 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89 | 144;

/** A Fibonacci px length for sx/spacing props, e.g. fib(13) → "13px". */
export const fib = (n: Fibonacci) => `${n}px`;
