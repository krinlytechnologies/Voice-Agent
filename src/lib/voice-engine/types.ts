// Typed boundary to the separately deployed Python voice engine (the `agent` service).
// Nothing here implements ASR/LLM/TTS/telephony.
//
// The engine implements every route below (agent/app/api.py, agent/app/dispatch.py): bearer
// authentication (`Authorization: Bearer <its APP_SECRET_KEY>`), `GET /health`,
// `POST /campaigns/dispatch`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, and signed webhook
// events delivered to `webhookUrl`. Every dispatch carries a copy of the persona (`persona`); the
// engine's calls for that campaign say exactly that copy. The voice is the engine agent's own setting.

/** Exactly what the engine's `GET /health` returns (it answers 500 if its database is down). */
export interface VoiceEngineHealth {
  status: "ok";
  active_calls: number;
}

/** The conversation shapes the engine knows (agent/app/models.py `Workflow`). */
export const engineWorkflows = [
  "general",
  "faq",
  "appointment",
  "order",
  "lead_qualification",
] as const;
export type EngineWorkflow = (typeof engineWorkflows)[number];

/** A copy of the Prompts-page persona as it was when a campaign was started or a route published. */
export interface PersonaSnapshot {
  key: string;
  name: string;
  language: "en" | "hi" | "ta" | "te";
  workflow: EngineWorkflow;
  instructions: string;
  greeting: string;
  knowledge: string;
  version: number;
}

/** `PUT /inbound/routes`: which persona answers a dialled number. `version` rises with every publish. */
export interface InboundRoutePublishRequest {
  phone: string;
  clientId: string;
  version: number;
  active: boolean;
  persona: PersonaSnapshot;
}

export type InboundPublishResult =
  | { kind: "applied" }
  | { kind: "unchanged" }
  | { kind: "stale"; currentVersion: number }
  | { kind: "rejected"; code: string; message: string };

/** `GET /inbound/routes/{phone}` */
export interface InboundRouteState {
  phone: string;
  clientId: string;
  version: number;
  active: boolean;
  personaKey: string;
  personaVersion: number;
  workflow: EngineWorkflow;
  status: "current";
}

export interface DispatchCampaignRequest {
  idempotencyKey: string;
  campaignId: string;
  clientId: string;
  persona: PersonaSnapshot;
  callingWindow: { start: string; end: string };
  retryPolicy: { maxTries: number; retryGapMinutes: number; callbackWindowDays: number };
  leads: { id: string; phone: string; name: string }[];
  webhookUrl: string;
}

export type DispatchCampaignResponse =
  | { engineJobId: string; status: "accepted"; reason?: string | null }
  | { engineJobId: string | null; status: "rejected"; reason?: string | null };

export type EngineJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobStatusResponse {
  engineJobId: string;
  status: EngineJobStatus;
  callsCompleted: number;
  callsFailed: number;
}

export type VoiceEngineEventType =
  | "call.started"
  | "call.completed"
  | "call.failed"
  | "job.completed"
  | "job.cancelled"
  | "job.failed";

/** What one finished call attempt means for its lead. "queued" = interrupted by a cancel, left for later. */
export type LeadState = "done" | "retry" | "exhausted" | "queued";

export interface VoiceEngineEvent {
  eventId: string;
  eventType: VoiceEngineEventType;
  engineJobId: string;
  occurredAt: string;
  data: {
    engineCallId?: string;
    leadId?: string;
    leadPhone?: string;
    outcome?: string;
    durationSeconds?: number;
    attempt?: number;
    leadState?: LeadState;
    nextAttemptAt?: string;
    transcriptUrl?: string;
    /** An opaque engine call id, not a link (see inbound-events.ts). */
    transcriptRef?: string;
    minutesUsed?: number;
    errorMessage?: string;
  };
}

/** `GET /calls/{id}` (the engine's existing call detail), reduced to what Mona reads. */
export interface EngineCallDetail {
  id: number;
  direction: "inbound" | "outbound";
  from_number: string | null;
  to_number: string | null;
  turns: { idx: number; user_text: string | null; agent_text: string }[];
}

/** `GET /inbound/unrouted`: a dialled number that calls reached with no published route. */
export interface UnroutedNumber {
  /** Digits, country code first (no +). */
  phone: string;
  rawExample: string;
  calls: number;
  firstSeen: string;
  lastSeen: string;
  answeredBy: "default_agent" | "refused";
}
