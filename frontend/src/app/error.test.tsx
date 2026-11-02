import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "../../test/next-mocks";
import ErrorPage from "./error";

describe("app error boundary", () => {
  it("explains, logs the error, and offers a retry and a way back", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const error = new Error("No filter operator found");

    render(<ErrorPage error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByText(/No filter operator/)).not.toBeInTheDocument(); // no internals shown
    expect(log).toHaveBeenCalledWith(error);
    expect(screen.getByRole("link", { name: "Back to the directory" })).toHaveAttribute("href", "/");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
