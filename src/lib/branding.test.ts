import { describe, expect, it } from "vitest";
import monaLogo from "@/assets/mona-logo.png.asset.json";
import { monaLogoUrl } from "./branding";

describe("official Mona logo hosting", () => {
  it("keeps the official asset on its serving host even from Vercel", () => {
    const resolved = new URL(monaLogoUrl, "https://example.vercel.app");
    expect(resolved.origin).toBe("https://monaaivoiceagent.lovable.app");
    expect(resolved.pathname).toBe(monaLogo.url);
    expect(resolved.pathname).toContain(monaLogo.asset_id);
  });
});