import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "./States";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

describe("PageHeader", () => {
  afterEach(() => {
    cleanup();
    navigateMock.mockReset();
  });

  it("renders a back button by default", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Squadre" description="Elenco completo delle squadre NBA." />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Torna alla pagina precedente" })).toBeInTheDocument();
    expect(screen.getByText("Indietro")).toBeInTheDocument();
  });

  it("falls back to the home page when there is no in-app history", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Squadre" description="Elenco completo delle squadre NBA." />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Torna alla pagina precedente" }));

    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
