import { env } from "./appsettings";

export class Recorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recordedSamples: Float32Array[] = [];
  private sampleRate = 48_000;

  private constructor(stream: MediaStream) {
    this.mediaStream = stream;
  }

  static async create(): Promise<Recorder | null> {
    console.log("create recorder");
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 48_000 } as unknown as MediaTrackConstraints,
    });
    return new Recorder(mediaStream);
  }

  async start(): Promise<void> {
    console.log("start recorder");
    if (!this.mediaStream) {
      throw new Error("Media stream not available");
    }
    this.recordedSamples = [];
    this.audioContext = new AudioContext({ sampleRate: 48_000 });
    this.sampleRate = this.audioContext.sampleRate;
    this.sourceNode = this.audioContext.createMediaStreamSource(
      this.mediaStream,
    );
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer.getChannelData(0);
      this.recordedSamples.push(new Float32Array(input));
    };
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  async stop(): Promise<string | null> {
    console.log("stop recorder", !!this.processorNode);
    if (!this.processorNode || !this.audioContext) {
      return null;
    }

    this.processorNode.disconnect();
    this.sourceNode?.disconnect();
    await this.audioContext.close();
    this.processorNode = null;
    this.sourceNode = null;
    this.audioContext = null;

    const wavBlob = encodeWav(this.recordedSamples, this.sampleRate);
    this.recordedSamples = [];

    const formData = new FormData();
    formData.append("file", wavBlob, "audio.wav");
    formData.append("model", "CoRal-project/roest-v3-whisper-1.5b");

    const response = await fetch(`${env.BASE_URL}v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.API_KEY}`,
      },
      body: formData,
    });
    const text = (await response.json()).text;
    return text;
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
