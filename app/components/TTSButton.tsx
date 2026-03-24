import * as React from "react";

import LoadingButtonIcon from "../icons/loading.svg";

export function TTSButton(props: { message: string }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = React.useRef<Set<string>>(new Set());
  const playTokenRef = React.useRef(0);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });

      if (!res.ok) {
        // Try to surface a more useful error than "blob not playable".
        const detail = await res.text().catch(() => "");
        throw new Error(
          `TTS request failed (${res.status})${
            detail ? `: ${detail}` : ""
          }`,
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
          const onEnded = () => resolve();
          const onError = () =>
            reject(new Error("Failed to play TTS audio"));

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

  const onClick = async () => {
    const service = process.env.NEXT_PUBLIC_TTS_SERVICE as
      | string
      | undefined
      | null;
    const text = props.message?.trim();

    if (!service || !text) return;
    if (isLoading) return;

    // If user clicks again, stop current playback + cancel in-flight loop.
    stopPlayback();

    setIsLoading(true);
    setError(null);

    const token = playTokenRef.current;
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) {
      setIsLoading(false);
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
          nextFetch = fetchWavFromService(
            service,
            sentences[i + 1],
            token,
          );
        }

        const stillValid = await playAudioUrl(currentAudioUrl, token);
        if (!stillValid) return;

        if (!isLast) {
          currentAudioUrl = await nextFetch!;
          if (!currentAudioUrl) return;
        }
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "TTS failed";
      setError(message);
      console.error("TTS error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      title={error ? `TTS failed: ${error}` : "Play"}
      aria-label="Play"
      style={{
        float: "right",
        fontSize: "30px",
        cursor: "pointer",
        margin: 8,
        padding: 0,
        lineHeight: 1,
        background: "transparent",
        border: "none",
      }}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <LoadingButtonIcon style={{ width: 30, height: 30 }} />
      ) : (
        "🔈"
      )}
    </button>
  );
}

