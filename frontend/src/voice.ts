
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { API_BASE_URL } from "./api";

export interface VoiceCallbacks {
  onStateChange: (state: string) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (message: string) => void;
}

export function createVoiceClient(callbacks: VoiceCallbacks) {
  const audio = new Audio();
  audio.autoplay = true;

  const client = new PipecatClient({
    transport: new SmallWebRTCTransport(),
    enableMic: true,
    enableCam: false,

    callbacks: {
      onTransportStateChanged: (state) => {
        callbacks.onStateChange(state);
      },

      onBotReady: () => {
        callbacks.onStateChange("ready");
      },

      onDisconnected: () => {
        audio.srcObject = null;
        callbacks.onStateChange("disconnected");
        callbacks.onSpeakingChange(false);
      },

      onTrackStarted: (track, participant) => {
        if (track.kind === "audio" && !participant?.local) {
          audio.srcObject = new MediaStream([track]);

          audio.play().catch(() => {
            callbacks.onError("Unable to play agent audio.");
          });
        }
      },

      onUserTranscript: (data) => {
        if (data.final && data.text.trim()) {
          callbacks.onTranscript("user", data.text);
        }
      },

      onBotTranscript: (data) => {
        if (data.text.trim()) {
          callbacks.onTranscript("assistant", data.text);
        }
      },

      onBotStartedSpeaking: () => {
        callbacks.onSpeakingChange(true);
      },

      onBotStoppedSpeaking: () => {
        callbacks.onSpeakingChange(false);
      },
    },
  });

  return {
    async connect() {
      try {
        await client.connect({
          connection_url: `${API_BASE_URL}/api/offer`,
        });
      } catch (error) {
        callbacks.onError(
          error instanceof Error
            ? error.message
            : "Unable to connect to CareLine."
        );

        throw error;
      }
    },

    async disconnect() {
      await client.disconnect();
      audio.srcObject = null;
    },

    setMuted(muted: boolean) {
      client.enableMic(!muted);
    },
  };
}
