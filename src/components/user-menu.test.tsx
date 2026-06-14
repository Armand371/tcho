import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/session";

import { UserMenu } from "./user-menu";

const noop = async () => {};

describe("UserMenu", () => {
  it("shows the user's name and a sign-out control", () => {
    const user: SessionUser = {
      email: "kid@example.com",
      name: "Kid Example",
      picture: "https://lh3.googleusercontent.com/a/avatar",
    };

    render(<UserMenu user={user} signOutAction={noop} />);

    expect(screen.getByText("Kid Example")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("falls back to the email and an initial when name/picture are absent", () => {
    const user: SessionUser = {
      email: "admin@outside.test",
      name: null,
      picture: null,
    };

    render(<UserMenu user={user} signOutAction={noop} />);

    expect(screen.getByText("admin@outside.test")).toBeInTheDocument();
    // No avatar image — the initial stands in.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
