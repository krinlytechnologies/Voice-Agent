import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { InboundNumbers } from "@/components/dashboard/InboundNumbers";

export const Route = createFileRoute("/inbound")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inbound numbers — Mona" },
      {
        name: "description",
        content:
          "Choose which persona answers each phone number and publish it to your live calls.",
      },
      { property: "og:title", content: "Inbound numbers — Mona" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceShell active="Inbound Numbers">
      <InboundNumbers />
    </WorkspaceShell>
  ),
});
