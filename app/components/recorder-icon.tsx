import * as React from "react";

import LoadingButtonIcon from "../icons/loading.svg";
import MicrophoneSttIcon from "../icons/microphone-stt.svg";
import { Recorder } from "../utils/recorder";

const MAX_RECORDING_MS = 30_000;

export function RecorderIcon(props: {
  onTranscribed: (text: string) => void;
  // placement is set by the parent (inside the chat input box)
  className?: string;
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

  const onClick = (e: React.MouseEvent) => {
    // the button sits inside the chat input's <label>; don't let the click
    // also focus the text field (that would open the keyboard on mobile)
    e.preventDefault();
    if (isTranscribing) return;
    if (isRecording) {
      void stop();
    } else {
      void start();
    }
  };

  return (
    <div className={props.className}>
      {isRecording && (
        <span style={{ fontSize: "11px" }}>{`${seconds.toFixed(1)}s`}</span>
      )}
      <div
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
          <LoadingButtonIcon style={{ width: 24, height: 24 }} />
        ) : (
          <MicrophoneSttIcon
            style={{
              width: 24,
              height: 24,
              color: isRecording ? "red" : "var(--primary)",
            }}
          />
        )}
      </div>
    </div>
  );
}
