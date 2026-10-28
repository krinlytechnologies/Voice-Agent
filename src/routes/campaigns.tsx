import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { Campaigns } from "@/components/dashboard/Campaigns";

export const Route = createFileRoute("/campaigns")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Campaigns — Mona" },
    { name: "description", content: "Manage Mona voice campaigns, explore call results and organise lead follow-ups." },
    { property: "og:title", content: "Campaigns — Mona" },
    { property: "og:description", content: "Your voice outreach campaigns, results and lead pipeline in one workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: CampaignsPage,
});
function CampaignsPage() { return <WorkspaceShell active="Campaigns"><Campaigns /></WorkspaceShell>; }