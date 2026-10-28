import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { VoiceLeads } from "@/components/dashboard/VoiceLeads";

export const Route = createFileRoute("/voice-leads")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Voice Leads — Mona" },
    { name: "description", content: "Explore Mona voice leads, conversation outcomes, calling queues and follow-ups by campaign." },
    { property: "og:title", content: "Voice Leads — Mona" },
    { property: "og:description", content: "Your campaign contacts, conversation outcomes and next follow-ups in one Mona workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: VoiceLeadsPage,
});
function VoiceLeadsPage() { return <WorkspaceShell active="Voice Leads"><VoiceLeads /></WorkspaceShell>; }