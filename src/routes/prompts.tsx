import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { Prompts } from "@/components/dashboard/Prompts";
export const Route = createFileRoute("/prompts")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Prompts — Mona" },
    { name: "description", content: "Shape voice conversations with Mona persona prompts, knowledge, greetings and call behavior." },
    { property: "og:title", content: "Prompts — Mona" },
    { property: "og:description", content: "Your voice persona conversation studio in Mona." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <WorkspaceShell active="Prompts"><Prompts /></WorkspaceShell>,
});