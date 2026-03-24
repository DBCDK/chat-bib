export class Recorder {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: BlobPart[] = []
  private readonly asrEndpoint: string

  private constructor(stream: MediaStream, asrEndpoint: string) {
    this.mediaStream = stream
    this.asrEndpoint = asrEndpoint
  }

  static async create({
    asrEndpoint,
  }: {
    asrEndpoint: string
  }): Promise<Recorder | null> {
    console.log('create recorder');
      const constraints: MediaStreamConstraints = {
        audio: { sampleRate: 48_000 } as unknown as MediaTrackConstraints,
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints as MediaStreamConstraints,
      )
      return new Recorder(mediaStream, asrEndpoint)
  }

  async start(): Promise<void> {
    console.log('start recorder');
    if (!this.mediaStream) {
      throw new Error('Media stream not available')
    }
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
    })
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data)
          }
        }
    this.recordedChunks = []
    this.mediaRecorder.start()
  }

  async stop(): Promise<string | null> {
    const recorder = this.mediaRecorder;
    console.log('stop recorder', !!recorder);
    if(!recorder) {
      return null
    }


    return new Promise<string | null>((resolve) => {
      recorder.onstop = async () => {
        const audioBlob = new Blob(this.recordedChunks, {
          type: 'audio/webm;codecs=opus',
        })
        const response = await fetch(this.asrEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/webm',
          },
          body: audioBlob,
        })
        const text = (await response.json()).text;
        resolve(text);
      }
      recorder.stop()
    })
  }
}