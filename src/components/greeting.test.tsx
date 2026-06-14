import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Greeting } from "./greeting";

describe("Greeting", () => {
  it("renders the provided name", () => {
    render(<Greeting name="Armand" />);
    expect(screen.getByText("Hello, Armand!")).toBeInTheDocument();
  });
});
