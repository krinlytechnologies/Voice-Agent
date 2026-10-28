import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/dashboard/Overview";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Mona" },
      { name: "description", content: "Your Mona workspace: campaigns, voice leads, prompts and calls." },
      { property: "og:title", content: "Dashboard — Mona" },
      { property: "og:description", content: "Your Mona workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return <WorkspaceShell active="Dashboard"><Overview /></WorkspaceShell>;
}
