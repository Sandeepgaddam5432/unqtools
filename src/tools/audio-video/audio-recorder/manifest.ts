import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-recorder",
  name: "Audio Recorder",
  description:
    "Record audio from your microphone entirely in the browser with MediaRecorder. Multi-format support (webm/ogg/mp3), 4 bitrate presets, max-duration limit, pause/resume, live MM:SS.ms timer, file-size estimator, timestamped filename, in-page audio preview, recording history (localStorage), shareable URL settings, format support detection, permission error handler, and summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio recorder", "microphone", "record audio",
    "voice recorder", "media recorder", "webm", "ogg", "mp3",
    "voice memo", "browser recorder",
  ],
  icon: "mic",
  requiresNetwork: false,
  seo: {
    title: "Audio Recorder — Browser Microphone Recording (webm/ogg/mp3) | UnQTools",
    faq: [
      {
        q: "How does the audio recorder work?",
        a: "Click Start, grant microphone permission, and we use the browser's MediaRecorder API to capture audio chunks. When you stop, the chunks are combined into a Blob and you can preview it inline or download it. All processing happens locally in your browser.",
      },
      {
        q: "What audio formats are supported?",
        a: "We auto-detect format support: WebM (Chrome/Firefox), OGG (Firefox), and MP3 (where supported). The format selector only shows options your browser can actually record in. Each format has 4 bitrate presets: low (64 kbps), medium (128 kbps), high (192 kbps), and lossless (320 kbps).",
      },
      {
        q: "Can I pause and resume a recording?",
        a: "Yes. Pause temporarily halts capture without stopping the recording; Resume continues appending to the same Blob. The live timer reflects only the active recording time, not paused intervals.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format support (webm/ogg/mp3). (2) Bitrate selection (4 presets). (3) Max duration limit (6 presets, auto-stop). (4) Live MM:SS.ms timer. (5) Pause/resume. (6) Auto-stop at max duration. (7) File-size estimator. (8) Timestamped filename generator. (9) In-page audio preview player. (10) Recording history (localStorage, last 20). (11) Shareable URL settings. (12) Format support detection. (13) Microphone permission error handler. (14) Summary stats (total recordings, total duration, total size).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The microphone stream, recorded chunks, and final Blob never leave your browser. There are no uploads. Recording metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
