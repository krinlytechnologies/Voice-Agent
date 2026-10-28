import type { EngineWorkflow, PersonaSnapshot } from "./types";

// The engine speaks these four languages (agent/app/models.py `Language`); prompts.ts offers the same labels.
const ENGINE_LANGUAGE: Record<string, PersonaSnapshot["language"]> = {
  English: "en",
  Hindi: "hi",
  Tamil: "ta",
  Telugu: "te",
};

/** Only a lead-qualification campaign has a qualifying goal; every other purpose is a plain conversation. */
export function workflowForPurpose(purpose: string): EngineWorkflow {
  return purpose === "Lead qualification" ? "lead_qualification" : "general";
}

export interface PersonaSource {
  personaKey: string;
  name: string;
  language: string;
  instructions: string;
  greeting: string;
  knowledge: string;
  currentVersion: number;
}

/** What the engine is told to say. Null when the persona's language is one the engine cannot speak. */
export function personaSnapshot(
  source: PersonaSource,
  workflow: EngineWorkflow,
): PersonaSnapshot | null {
  const language = ENGINE_LANGUAGE[source.language];
  if (!language) return null;
  return {
    key: source.personaKey,
    name: source.name,
    language,
    workflow,
    instructions: source.instructions,
    greeting: source.greeting,
    knowledge: source.knowledge,
    version: source.currentVersion,
  };
}
