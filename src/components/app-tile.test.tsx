import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppEntry } from "@/apps/registry";

import { AppTile } from "./app-tile";

const app: AppEntry = {
  slug: "chores",
  name: "Chores",
  description: "Track this week's chores",
  icon: "🧹",
};

describe("AppTile", () => {
  it("renders the name and description and links to the derived app route", () => {
    render(<AppTile app={app} />);

    const link = screen.getByRole("link", { name: /chores/i });
    expect(link).toHaveAttribute("href", "/apps/chores");
    expect(screen.getByText("Track this week's chores")).toBeInTheDocument();
  });

  it("renders the icon when one is provided", () => {
    render(<AppTile app={app} />);
    expect(screen.getByText("🧹")).toBeInTheDocument();
  });

  it("omits the icon when none is provided", () => {
    const withoutIcon: AppEntry = {
      slug: "meals",
      name: "Meals",
      description: "This week's dinners",
    };
    render(<AppTile app={withoutIcon} />);
    expect(screen.queryByText("🧹")).not.toBeInTheDocument();
  });
});
