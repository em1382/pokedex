import { describe, expect, it } from "vitest";

import { fib } from "./spacing";

describe("fib", () => {
  it("formats a Fibonacci number as px", () => {
    expect(fib(13)).toBe("13px");
    expect(fib(1)).toBe("1px");
    expect(fib(144)).toBe("144px");
  });

  it("rejects non-Fibonacci values at compile time", () => {
    // @ts-expect-error 16 is not a Fibonacci number
    expect(fib(16)).toBe("16px");
  });
});
