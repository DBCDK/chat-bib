import * as React from "react";

import LoadingButtonIcon from "../icons/loading.svg";
import { Recorder } from "../utils/recorder";

const MAX_RECORDING_MS = 30_000;

export function RecorderIcon(props: {
  onTranscribed: (text: string) => void;
}) {
  const recorderRef = React.useRef<Recorder | null>(null);
  const stopTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const tickIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);

  const stop = React.useCallback(async () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const text = await recorder.stop();
      if (text) props.onTranscribed(text);
    } finally {
      setIsTranscribing(false);
    }
  }, [props]);

  const start = async () => {
    if (!recorderRef.current) {
      recorderRef.current = await Recorder.create();
    }
    await recorderRef.current?.start();
    setIsRecording(true);
    setSeconds(0);
    const startedAt = Date.now();
    tickIntervalRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 100) / 10);
    }, 100);
    stopTimeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
  };

  const onClick = () => {
    if (isTranscribing) return;
    if (isRecording) {
      void stop();
    } else {
      void start();
    }
  };

  return (
    <div
      style={{
        float: "left",
        margin: 8,
        width: 44,
        height: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        lineHeight: 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          cursor: isTranscribing ? "default" : "pointer",
        }}
        onClick={onClick}
        role="button"
        aria-label={
          isTranscribing
            ? "Transcribing"
            : isRecording
              ? "Stop recording"
              : "Start recording"
        }
      >
        {isTranscribing ? (
          <LoadingButtonIcon style={{ width: 26, height: 26 }} />
        ) : isRecording ? (
          "⏹"
        ) : (
          "🎤"
        )}
      </div>
      <div style={{ fontSize: "11px", height: 16, lineHeight: "16px" }}>
        {isRecording ? `${seconds.toFixed(1)}s` : ""}
      </div>
    </div>
  );
}
