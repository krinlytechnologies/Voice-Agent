import monaLogo from "@/assets/mona-logo.png.asset.json";

// The asset gateway exists on Lovable hosting, not on external hosts such as
// Vercel. Keep the official asset pointer and resolve it against its host.
export const monaLogoUrl = new URL(
  monaLogo.url,
  "https://monaaivoiceagent.lovable.app",
).href;