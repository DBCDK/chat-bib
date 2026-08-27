import * as React from "react";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";

import LoadingButtonIcon from "../icons/loading.svg";
import SpeakerTtsIcon from "../icons/speaker-Tts.svg";
import { env } from "../utils/appsettings";
import { IconButton } from "./button";

// Plays a chat answer out loud, one sentence at a time. While one sentence
// plays, the next one is already being downloaded, so there is no pause
// between them.
// There are two ways this can start. One is the play button under a single
// answer, which only reads that one answer. The other is the auto read
// button in the chat header, which reads every new answer by itself once
// turned on.
export function useTts() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The id of the message being read right now. The play button for that
  // message uses it to show that it is playing.
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = React.useRef<Set<string>>(new Set());
  const playTokenRef = React.useRef(0);

  // base64 (of a 16-bit PCM WAV) -> object URL, tracked for revocation.
  // Streaming analogue of fetchWavFromService's res.blob() -> createObjectURL.
  const base64ToAudioObjectUrl = React.useCallback(
    (b64: string): string | null => {
      let bin: string;
      try {
        bin = atob(b64);
      } catch {
        return null;
      }
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.add(url);
      return url;
    },
    [],
  );

  const splitIntoSentences = React.useCallback((raw: string): string[] => {
    // Split at newlines first, then split further at:
    //   /[.?] [A-Z][a-z]/
    // The regex below turns the boundary into a newline, keeping punctuation.
    const lines = raw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const out: string[] = [];
    for (const line of lines) {
      const marked = line.replace(
        /([.?])\s+([A-Z][a-z])/g,
        // Keep punctuation, start next sentence on its own line.
        "$1\n$2",
      );

      for (const part of marked.split(/\n/)) {
        const sentence = part.trim();
        if (sentence) out.push(sentence);
      }
    }

    return out;
  }, []);

  const stopPlayback = React.useCallback(() => {
    playTokenRef.current += 1; // invalidate any in-flight loop

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
      audioRef.current = null;
    }

    // Revoke any object URLs created by in-flight fetches.
    for (const url of objectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    objectUrlsRef.current.clear();
    setIsLoading(false);
    setIsPlaying(false);
    setActiveKey(null);
  }, []);

  const revokeUrl = React.useCallback((url: string) => {
    if (!objectUrlsRef.current.has(url)) return;
    try {
      URL.revokeObjectURL(url);
    } finally {
      objectUrlsRef.current.delete(url);
    }
  }, []);

  const fetchWavFromService = React.useCallback(
    async (service: string, sentence: string, token: number) => {
      if (token !== playTokenRef.current) return null;

      const res = await fetch(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.API_KEY}`,
        },
        body: JSON.stringify({
          input: sentence,
          model: "CoRal-project/roest-v3-chatterbox-500m-triton",
          response_format: "wav",
        }),
      });

      if (!res.ok) {
        // Try to surface a more useful error than "blob not playable".
        const detail = await res.text().catch(() => "");
        throw new Error(
          `TTS request failed (${res.status})${detail ? `: ${detail}` : ""}`,
        );
      }

      const blob = await res.blob();

      if (token !== playTokenRef.current) return null;

      const audioUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.add(audioUrl);
      return audioUrl;
    },
    [],
  );

  const playAudioUrl = React.useCallback(
    async (audioUrl: string, token: number) => {
      if (token !== playTokenRef.current) return false;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.load();

      try {
        await new Promise<void>((resolve, reject) => {
          const onPlaying = () => {
            if (token === playTokenRef.current) setIsPlaying(true);
          };
          const onEnded = () => resolve();
          const onError = () => reject(new Error("Failed to play TTS audio"));

          audio.addEventListener("playing", onPlaying, { once: true });
          audio.addEventListener("ended", onEnded, { once: true });
          audio.addEventListener("error", onError, { once: true });

          void audio.play().catch(reject);
        });
      } finally {
        // Revoke after this sentence is finished.
        revokeUrl(audioUrl);
      }

      return token === playTokenRef.current;
    },
    [revokeUrl],
  );

  // NEW: consume the audio stream from glyph-gate and enqueue each WAV chunk.
  // Reuses the repo's SSE consumer (openai.ts). The promise resolves when the
  // stream closes and rejects on a transport/content error, so the caller can
  // fall back or surface the error.
  const streamWavFromService = React.useCallback(
    (
      service: string,
      text: string,
      token: number,
      onChunk: (audioUrl: string) => void,
    ): Promise<void> => {
      return fetchEventSource(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.API_KEY}`,
        },
        // Stream against the triton adapter (it has stream_speech). The plain
        // chatterbox_tts model has no stream_speech and would 400 before the
        // first chunk, which would silently trip the non-streaming fallback.
        body: JSON.stringify({
          input: text,
          model: "CoRal-project/roest-v3-chatterbox-500m-triton",
          response_format: "wav",
          stream: true,
        }),
        openWhenHidden: true,
        onopen: async (res) => {
          // A non-2xx or a non-SSE body means streaming isn't supported; throw
          // so fetchEventSource rejects (no retry) and the caller can fall back.
          if (
            !res.ok ||
            !res.headers
              .get("content-type")
              ?.startsWith(EventStreamContentType)
          ) {
            throw new Error(`TTS stream failed (${res.status})`);
          }
        },
        onmessage: (evt) => {
          if (token !== playTokenRef.current) return;
          if (evt.data === "[DONE]") return;
          let msg: {
            type?: string;
            audio?: string;
            message?: string;
            error?: { message?: string };
          };
          try {
            msg = JSON.parse(evt.data);
          } catch {
            return;
          }
          if (msg.type === "audio" && msg.audio) {
            const url = base64ToAudioObjectUrl(msg.audio);
            if (url) onChunk(url);
          } else if (msg.error || msg.message || msg.type === "error") {
            // glyph-gate emits an OpenAI-style error frame before [DONE].
            // Close the stream; the caller decides fallback vs. showing it.
            throw new Error(msg.message || msg.error?.message || "ukendt fejl");
          }
          // meta / done: nothing to do here; the stream close finalizes.
        },
        onerror: (err) => {
          // Throw so fetchEventSource rejects instead of retrying.
          throw err;
        },
      });
    },
    [base64ToAudioObjectUrl],
  );

  // Non-streaming fallback: the old per-fragment pipeline. Kept so TTS still
  // works if a deployment hasn't been upgraded to stream (see speak below).
  const speakFragments = React.useCallback(
    async (service: string, text: string) => {
      const token = playTokenRef.current;
      const sentences = splitIntoSentences(text);
      if (sentences.length === 0) {
        setIsLoading(false);
        setIsPlaying(false);
        setActiveKey(null);
        return;
      }

      try {
        // Pipeline: fetch sentence N+1 while sentence N is playing.
        let currentAudioUrl = await fetchWavFromService(
          service,
          sentences[0],
          token,
        );
        if (!currentAudioUrl) return;

        let nextFetch: Promise<string | null> | null = null;

        for (let i = 0; i < sentences.length; i++) {
          if (token !== playTokenRef.current) return;

          const isLast = i === sentences.length - 1;
          if (!isLast) {
            // Kick off the next request immediately, while current audio plays.
            nextFetch = fetchWavFromService(service, sentences[i + 1], token);
          }

          const stillValid = await playAudioUrl(currentAudioUrl, token);
          if (!stillValid) return;

          if (!isLast) {
            currentAudioUrl = await nextFetch!;
            if (!currentAudioUrl) return;
          }
        }
      } catch (e: unknown) {
        // If the user stops playback, the sentence that was loading also
        // fails, which would show a fake error. Only show a real error if
        // this play attempt is still the active one.
        if (token === playTokenRef.current) {
          const message =
            e instanceof Error
              ? e.message
              : typeof e === "string"
                ? e
                : "ukendt fejl";
          setError(message);
          console.error("TTS error:", e);
        }
      } finally {
        if (token === playTokenRef.current) {
          setIsLoading(false);
          setIsPlaying(false);
          setActiveKey(null);
        }
      }
    },
    [splitIntoSentences, fetchWavFromService, playAudioUrl],
  );

  // Streaming happy path: one request, the server chunks and streams. Play
  // each chunk back-to-back as it arrives via a FIFO queue. If the stream
  // errors before the first chunk, fall back to the non-streaming path.
  const speak = React.useCallback(
    async (message: string, key: string | null = null) => {
      const service = env.ENABLE_TTSASR
        ? `${env.BASE_URL}v1/audio/speech`
        : null;
      const text = message?.trim();
      if (!service || !text) return;

      // Stop anything already playing so a new answer replaces the old one.
      stopPlayback();

      setIsLoading(true);
      setIsPlaying(false);
      setError(null);
      setActiveKey(key);
      const token = playTokenRef.current;

      // A FIFO of object URLs awaiting play. Play the front; when it ends,
      // play the next. Finalize only once the stream is closed AND the queue
      // is drained, so the last chunk finishes before we reset the UI.
      const queue: string[] = [];
      let playingCurrent = false;
      let streamClosed = false;
      let finished = false;
      let receivedAnyChunk = false;

      const finalize = () => {
        if (finished) return;
        finished = true;
        if (token === playTokenRef.current) {
          setIsLoading(false);
          setIsPlaying(false);
          setActiveKey(null);
        }
      };

      const pump = () => {
        if (token !== playTokenRef.current) return;
        const next = queue.shift();
        if (next) {
          playingCurrent = true;
          void playAudioUrl(next, token).then(() => {
            if (token !== playTokenRef.current) return;
            playingCurrent = false;
            pump();
          });
        } else if (streamClosed) {
          finalize();
        }
      };

      const onChunk = (url: string) => {
        if (token !== playTokenRef.current) return;
        receivedAnyChunk = true;
        queue.push(url);
        if (!playingCurrent) pump();
      };

      try {
        await streamWavFromService(service, text, token, onChunk);
      } catch (e: unknown) {
        if (token !== playTokenRef.current) return;
        // No audio was ever queued: the stream failed before the first chunk.
        // Fall back to the non-streaming per-fragment path so TTS still works.
        if (!receivedAnyChunk) {
          void speakFragments(service, text);
          return;
        }
        // Audio already played, then the stream errored: partial playback is
        // fine (no replay); surface the error instead.
        setError(e instanceof Error ? e.message : "ukendt fejl");
      }

      // Stream closed (or errored mid-play). If nothing is playing, drain the
      // queue now (pump finalizes when empty); if something is playing, its
      // .then() pumps again when it ends. A token change aborts this path.
      streamClosed = true;
      if (!playingCurrent) pump();
    },
    [stopPlayback, streamWavFromService, playAudioUrl, speakFragments],
  );

  return {
    activeKey,
    isLoading,
    isPlaying,
    error,
    speak,
    stop: stopPlayback,
  };
}

type TtsController = ReturnType<typeof useTts>;

export function TTSButton(props: {
  message: string;
  messageKey: string;
  tts: TtsController;
}) {
  const { activeKey, isLoading, isPlaying, speak, stop } = props.tts;

  // Every answer has its own play button. This makes sure only the button
  // for the answer that is actually playing shows the playing icon, even
  // when the auto read button started it instead of a click.
  const active = activeKey === props.messageKey;
  const busy = active && (isLoading || isPlaying);

  return (
    <IconButton
      title={busy ? "Stop oplæsning" : "Læs højt"}
      icon={
        active && isPlaying ? (
          <span
            style={{ fontSize: 16, lineHeight: 1, color: "var(--primary)" }}
          >
            ⏹
          </span>
        ) : active && isLoading ? (
          <LoadingButtonIcon style={{ width: 16, height: 16 }} />
        ) : (
          <SpeakerTtsIcon
            style={{ width: 16, height: 16, color: "var(--primary)" }}
          />
        )
      }
      onClick={() => {
        if (busy) {
          stop();
        } else {
          void speak(props.message, props.messageKey);
        }
      }}
    />
  );
}
