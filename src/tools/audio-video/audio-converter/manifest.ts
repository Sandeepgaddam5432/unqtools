import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-converter",
  name: "Audio Converter",
  description:
    "Convert audio files between formats entirely in the browser. Decode with Web Audio API, re-encode to WAV (PCM 16-bit), WebM/OGG (via MediaRecorder), or MP3 (via MediaRecorder with WAV fallback). Multi-format output, 4 bitrate presets, 6 sample-rate presets, mono/stereo channel selection, pure-JS 44-byte RIFF WAV header builder, Float32 to 16-bit PCM converter, file-size estimator, quality score calculator (0-100), lossless-vs-lossy compatibility checker, smart filename generator, conversion history (localStorage), shareable URL, drag-and-drop, and summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio converter", "convert audio", "wav to mp3",
    "mp3 to wav", "wav converter", "webm audio",
    "ogg converter", "audio format", "audio transcode",
    "pcm wav", "audio encoder",
  ],
  icon: "file-audio",
  requiresNetwork: false,
  seo: {
    title: "Audio Converter — WAV / MP3 / WebM / OGG (Browser-based) | UnQTools",
    faq: [
      {
        q: "How does the audio converter work?",
        a: "Drop or pick an audio file. We decode it locally with the Web Audio API (decodeAudioData), then re-encode to your selected format. WAV output uses a pure-JS 44-byte RIFF PCM 16-bit encoder. WebM and OGG use the MediaRecorder API. MP3 uses MediaRecorder where supported and gracefully falls back to WAV with a warning toast if not.",
      },
      {
        q: "What output formats are supported?",
        a: "Five formats: WAV (always available, pure-JS encoder), WebM (Chrome/Firefox/Edge), OGG (Firefox), MP3 (where MediaRecorder supports audio/mpeg), and M4A (where supported). Unsupported formats are disabled in the dropdown based on runtime detection.",
      },
      {
        q: "Can I change the bitrate, sample rate, and channels?",
        a: "Yes. 4 bitrate presets (64/128/192/320 kbps for lossy codecs), 6 sample-rate presets (8k/16k/22.05k/44.1k/48k/96k), and mono/stereo channel selection. We render the decoded buffer through an OfflineAudioContext at the target sample rate and channel count, then encode the result.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format output (WAV, MP3, WebM, OGG, M4A). (2) 4 bitrate presets. (3) 6 sample-rate presets. (4) Mono/stereo channel selection. (5) Pure-JS WAV header builder. (6) Float32 to 16-bit PCM converter. (7) File-size estimator. (8) Quality score calculator (0-100). (9) Lossless-vs-lossy compatibility checker. (10) Smart filename generator. (11) Conversion history (localStorage, last 20). (12) Shareable URL settings. (13) Drag-and-drop file input. (14) Summary stats (original size, output size, % change, duration).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Audio decoding and encoding all happen locally in your browser via the Web Audio API and MediaRecorder. Your file is never uploaded. Conversion metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
