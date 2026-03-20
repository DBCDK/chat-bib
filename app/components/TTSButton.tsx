import * as React from "react";

export function TTSButton(props: { message: string }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  const onClick = async () => {
    const service = process.env.NEXT_PUBLIC_TTS_SERVICE as
      | string
      | undefined
      | null;
    const text = props.message?.trim();

    if (!service || !text) return;
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    // Stop any currently playing audio and clean up the previous object URL.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    try {
      const res = await fetch(service, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`TTS request failed (${res.status})`);
      }

      // Expected: the service returns the wav bytes directly.
      const blob = await res.blob();
      const contentType = res.headers.get("content-type") || "";

      // Even if the content type is missing, we try to play it anyway.
      const audioUrl = URL.createObjectURL(blob);
      objectUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Some browsers need the load call after creating the Audio object.
      audio.load();

      // Revoke object URL after playback finishes to avoid memory leaks.
      audio.onended = () => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };

      // `play()` may reject if the browser blocks autoplay, but we are in a click handler.
      // If it rejects anyway, we surface it in console.
      void audio.play().catch((e) => {
        console.error("Failed to play TTS audio:", e);
        setError(
          contentType.includes("application/json")
            ? "TTS service did not return a WAV"
            : "Failed to play TTS audio",
        );
      });
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
      style={{ float: "right" }}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? "…" : "▶"}
    </button>
  );
}

