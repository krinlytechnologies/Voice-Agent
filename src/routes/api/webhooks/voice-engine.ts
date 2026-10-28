// Inbound webhook from the separately deployed Python voice engine.
// Authenticated by an HMAC signature over the raw body. The engine has no user session,
// so this route never uses the auth middleware.
//
// Answers the engine relies on: 2xx = handled (do not resend); 404/403/400/409 = this event can never be
// accepted (do not resend); 401 = bad signature; 429/408 and 5xx = try again later.
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/lib/db.server";
import { verifyWebhookSignature, processWebhookEvent } from "@/lib/voice-engine/webhook";
import { isInboundCallEvent, processInboundCallEvent } from "@/lib/voice-engine/inbound-events";
import type { VoiceEngineEvent } from "@/lib/voice-engine/types";

export const Route = createFileRoute("/api/webhooks/voice-engine")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["VOICE_ENGINE_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[voice-engine webhook] VOICE_ENGINE_WEBHOOK_SECRET is not set");
          return new Response("Server configuration error", { status: 500 });
        }

        // The signature is checked against the exact bytes received, before anything is parsed.
        const rawBody = await request.text();
        const signature = request.headers.get("x-voice-engine-signature");
        if (!verifyWebhookSignature(rawBody, signature, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          if (isInboundCallEvent(parsed)) {
            const result = await processInboundCallEvent(db, parsed);
            if (result.ok) return Response.json(result);
            return Response.json(
              { processed: false, reason: result.reason },
              { status: result.status },
            );
          }

          const event = parsed as VoiceEngineEvent;
          if (!event?.eventId || !event.eventType || !event.engineJobId) {
            return new Response("Missing eventId/eventType/engineJobId", { status: 400 });
          }
          const result = await processWebhookEvent(db, event);
          // The engine can report before the dispatch response has been saved here. 404 makes
          // it redeliver instead of treating the event as handled and dropping it.
          if (result.reason === "unknown engine job id")
            return Response.json(result, { status: 404 });
          return Response.json(result);
        } catch (error) {
          // 500 makes the engine redeliver; the event was not recorded, so the retry is processed.
          console.error("[voice-engine webhook]", error);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});
