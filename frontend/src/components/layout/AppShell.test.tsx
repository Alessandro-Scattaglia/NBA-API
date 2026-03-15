import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders sidebar navigation items", () => {
    render(
      <MemoryRouter initialEntries={["/players"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/players" element={<div>Contenuto giocatori</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Squadre")).toBeInTheDocument();
    expect(screen.getByText("Giocatori")).toBeInTheDocument();
    expect(screen.getByText("Contenuto giocatori")).toBeInTheDocument();
  });
});
