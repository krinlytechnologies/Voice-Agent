import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { CallOutcomeRules } from "@/components/dashboard/CallOutcomeRules";

export const Route = createFileRoute("/call-outcome-rules")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Call Outcome Rules — Mona" },
    { name: "description", content: "Define conversation outcomes, rule priorities and short hangup settings in your Mona workspace." },
    { property: "og:title", content: "Call Outcome Rules — Mona" },
    { property: "og:description", content: "Your conversation outcome definitions and priorities in Mona." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <WorkspaceShell active="Call Outcome Rules"><CallOutcomeRules /></WorkspaceShell>,
});