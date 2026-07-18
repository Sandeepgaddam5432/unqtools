import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-format-detector",
  name: "Audio Format Detector",
  description:
    "Detect audio file format from magic bytes entirely in the browser. Drag-and-drop a file, we read the first 64 bytes and match against 15+ audio format signatures (MP3 ID3/frame-sync, WAV, FLAC, OGG, M4A/AAC, WMA, AIFF, ALAC, OPUS, APE, TTA, WavPack, Speex, AMR, 3GP). Extracts sample rate, channels, bit depth, duration from headers. Includes MIME lookup, file extension lookup, container info (lossless/lossy), bit-depth & channel-layout tables, format comparison table, closest-match suggestion for unknown formats, confidence score, text/CSV/JSON exports, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio format detector", "magic bytes", "file signature",
    "format identifier", "audio codec", "container",
    "mp3 wav flac ogg m4a aac wma aiff opus ape tta",
  ],
  icon: "file-audio",
  requiresNetwork: false,
  seo: {
    title: "Audio Format Detector — Magic Bytes & Header Parser (15+ formats) | UnQTools",
    faq: [
      {
        q: "How does the audio format detector work?",
        a: "Drop or pick an audio file. We read the first 64 bytes of the file as an ArrayBuffer and match them against a lookup table of magic-byte signatures for 15+ audio formats (MP3 ID3v2 + frame sync, WAV/RIFF, FLAC, OGG, M4A/AAC, WMA/ASF, AIFF, OPUS, APE, TTA, WavPack, Speex, AMR, 3GP). Then we parse the format-specific header to extract sample rate, channels, bit depth, and duration where possible.",
      },
      {
        q: "Which formats are supported?",
        a: "Fifteen-plus: MP3, WAV, FLAC, OGG (Vorbis/Opus/Speex), M4A/AAC (MP4 container — M4A, M4B, isom, mp42), WMA (ASF), AIFF, ALAC (in MP4), Opus (in OGG), APE (Monkey's Audio), TTA, WavPack, Speex (in OGG), AMR, and 3GP audio (3gp4, 3gp5, 3g2a). Unknown formats get a closest-match suggestion list.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Magic-bytes lookup table (15+ formats). (2) Format → MIME type lookup. (3) Format → container info (lossless/lossy, codec, typical use). (4) Format → file extension lookup. (5) Per-format header parser (extracts sample rate, channels, bit depth, duration). (6) Bit depth lookup (8, 16, 24, 32, 32-float). (7) Channel layout lookup (mono, stereo, 5.1, 7.1). (8) Format comparison table (lossless vs lossy). (9) Render as text report. (10) Render as CSV. (11) Render as JSON. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (format, confidence, MIME, extension). (15) Closest match suggestion for unknown formats. (16) Confidence score (0–100 based on header match quality).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Only the first 64 bytes of your file are read locally in your browser to identify the format. The file is never uploaded. Detection metadata in history is stored in localStorage on this device only.",
      },
      {
        q: "What if my format is not recognized?",
        a: "We show a closest-match suggestion list computed by comparing the byte pattern's overlap with known signatures, and we still display the raw hex of the first 64 bytes so you can identify it manually. The confidence score is 0 if no signature matches.",
      },
    ],
  },
  status: "done",
};
