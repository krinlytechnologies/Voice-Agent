import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoDialog } from "./DemoDialog";

const submit = vi.fn();
let failNext = false;
vi.mock("@/lib/demo.functions", () => ({
  submitDemoRequest: async (args: unknown) => {
    submit(args);
    if (failNext) throw new Error("database unavailable");
    return { ok: true, id: "req-1" };
  },
}));

beforeEach(() => {
  submit.mockReset();
  failNext = false;
});

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Priya Sharma" } });
  fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: "priya@example.com" } });
  fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "+919876543210" } });
}

describe("DemoDialog (public demo-request form)", () => {
  it("submits a valid request through the server function and shows success", async () => {
    submit.mockResolvedValue({ ok: true, id: "req-1" });
    render(<DemoDialog open onClose={() => {}} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /Request my demo/ }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        data: {
          name: "Priya Sharma",
          email: "priya@example.com",
          phone: "+919876543210",
          company: "",
          message: "",
        },
      }),
    );
    expect(await screen.findByText(/Thanks, Priya\./)).toBeInTheDocument();
  });

  it("does not claim success when the server rejects the request", async () => {
    failNext = true;
    render(<DemoDialog open onClose={() => {}} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /Request my demo/ }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(screen.queryByText(/Thanks, Priya\./)).not.toBeInTheDocument();
  });

  it("never calls the server for an invalid submission", () => {
    render(<DemoDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Priya Sharma" } });
    fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "+919876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /Request my demo/ }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(/doesn't look right/)).toBeInTheDocument();
  });
});
