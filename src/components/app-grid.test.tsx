import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppEntry } from "@/apps/registry";

import { AppGrid } from "./app-grid";

const apps: AppEntry[] = [
  {
    slug: "chores",
    name: "Chores",
    description: "Track this week's chores",
  },
  {
    slug: "meals",
    name: "Meals",
    description: "This week's dinners",
  },
];

describe("AppGrid", () => {
  it("renders a tile per registered app", () => {
    render(<AppGrid apps={apps} />);

    expect(screen.getByRole("link", { name: /chores/i })).toHaveAttribute(
      "href",
      "/apps/chores",
    );
    expect(screen.getByRole("link", { name: /meals/i })).toHaveAttribute(
      "href",
      "/apps/meals",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows the empty state when no apps are registered", () => {
    render(<AppGrid apps={[]} />);

    expect(screen.getByText("No apps yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
