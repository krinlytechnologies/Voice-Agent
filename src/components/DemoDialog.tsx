import { useState } from "react";
import { X, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { submitDemoRequest } from "@/lib/demo.functions";

type Form = { name: string; email: string; phone: string; company: string; message: string };
const empty: Form = { name: "", email: "", phone: "", company: "", message: "" };

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary";

export function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof Form, string>> = {};
    if (form.name.trim().length < 2) next.name = "Please tell us your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      next.email = "That email doesn't look right.";
    if (!/^[+\d][\d\s\-()]{6,19}$/.test(form.phone.trim()))
      next.phone = "Please add a valid phone number.";
    if (form.message.trim().length > 600) next.message = "Keep it under 600 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    let failed = false;
    try {
      await submitDemoRequest({
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          message: form.message.trim(),
        },
      });
    } catch {
      failed = true;
    }
    setSubmitting(false);
    if (failed) {
      toast.error("Couldn't send your request", { description: "Please try again in a moment." });
      return;
    }
    setSent(true);
    toast.success("Request received", { description: "We'll reach out within one business day." });
  };

  const close = () => {
    onClose();
    if (sent) setForm(empty);
    setSent(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-rise"
        onClick={close}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-background shadow-soft animate-rise">
        <div className="flex items-center justify-between border-b border-border px-7 py-5">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Book a demo</p>
          <button
            onClick={close}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-orb text-primary-foreground">
              <CalendarCheck className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h3 className="mt-6 text-2xl font-semibold">
              Thanks, {form.name.trim().split(/\s+/)[0]}.
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              We've got your request. Someone from Mona will call you within one business day to set
              up your demo.
            </p>
            <button
              onClick={close}
              className="mt-8 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-primary"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="px-7 py-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="demo-name"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Your name *
                </label>
                <input
                  id="demo-name"
                  className={field}
                  placeholder="Priya Sharma"
                  value={form.name}
                  onChange={set("name")}
                  maxLength={100}
                />
                {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="demo-email"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Work email *
                  </label>
                  <input
                    id="demo-email"
                    type="email"
                    className={field}
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={set("email")}
                    maxLength={255}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="demo-phone"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Phone *
                  </label>
                  <input
                    id="demo-phone"
                    type="tel"
                    className={field}
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={set("phone")}
                    maxLength={20}
                  />
                  {errors.phone && (
                    <p className="mt-1.5 text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>
              </div>
              <div>
                <label
                  htmlFor="demo-company"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Company
                </label>
                <input
                  id="demo-company"
                  className={field}
                  placeholder="Acme Enterprises"
                  value={form.company}
                  onChange={set("company")}
                  maxLength={120}
                />
              </div>
              <div>
                <label
                  htmlFor="demo-message"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  What should Mona handle for you?
                </label>
                <textarea
                  id="demo-message"
                  rows={3}
                  className={`${field} resize-none`}
                  placeholder="e.g. Follow up on website enquiries in the evenings"
                  value={form.message}
                  onChange={set("message")}
                  maxLength={600}
                />
                {errors.message && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.message}</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-full bg-orb px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Request my demo"}
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              No commitment — a 15-minute call to see if Mona fits.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
