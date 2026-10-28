import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { CallJournal } from "@/components/dashboard/CallJournal";

export const Route = createFileRoute("/inbound-calls")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inbound Calls — Mona" },
      {
        name: "description",
        content:
          "Review calls to your published numbers: outcomes, duration, summaries and transcripts.",
      },
      { property: "og:title", content: "Inbound Calls — Mona" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceShell active="Inbound Calls">
      <CallJournal direction="inbound" />
    </WorkspaceShell>
  ),
});
