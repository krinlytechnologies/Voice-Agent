import { useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { toast } from "sonner";

export const AGENT_ID = "agent_1401m4xjmc1ffh6rsepkx634dv5d";

/** Shared voice agent controls. Must render inside <ConversationProvider>. */
export function useVoiceAgent() {
  const conversation = useConversation({
    onError: (e: unknown) => {
      console.error("Voice agent error:", e);
      toast.error("Couldn't connect to the voice agent. Please try again.");
    },
  });
  const status = conversation.status as string;
  const active = status === "connected" || status === "connecting";

  const start = useCallback(async () => {
    if (active) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Please allow microphone access to talk to our agent.");
      return;
    }
    try {
      await conversation.startSession({ agentId: AGENT_ID, connectionType: "webrtc" });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start the conversation. Please try again.");
    }
  }, [conversation, active]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  /** Start talking right where the visitor is. */
  const talk = useCallback(() => {
    void start();
  }, [start]);

  return { status, active, isSpeaking: conversation.isSpeaking, start, stop, talk };
}
