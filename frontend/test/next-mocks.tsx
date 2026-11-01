// next/link and next/navigation need the App Router runtime; tests use plain anchors.
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { vi } from "vitest";

export const pathname = { current: "/" };

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
    function Link({ href, onClick, ...props }, ref) {
      return (
        <a
          ref={ref}
          href={href}
          {...props}
          onClick={(e) => {
            onClick?.(e);
            e.preventDefault(); // jsdom can't navigate
          }}
        />
      );
    },
  ),
}));
