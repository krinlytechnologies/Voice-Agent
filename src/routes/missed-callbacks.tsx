import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { MissedCallbacks } from "@/components/dashboard/MissedCallbacks";

export const Route = createFileRoute("/missed-callbacks")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Missed Callbacks — Mona" },
      {
        name: "description",
        content: "See who asked to be called back, from your numbers and your campaigns.",
      },
      { property: "og:title", content: "Missed Callbacks — Mona" },
      {
        property: "og:description",
        content: "People who asked to be called back, with what they said.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceShell active="Missed Callbacks">
      <MissedCallbacks />
    </WorkspaceShell>
  ),
});
