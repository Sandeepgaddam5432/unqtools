import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-bitrate-calculator",
  name: "Audio Bitrate Calculator",
  description:
    "Calculate audio bitrate, file size, duration, and quality metrics entirely in the browser. Supports PCM/WAV, FLAC, ALAC, MP3, AAC, OGG/Vorbis, and Opus. Compute bitrate from sample rate × bit depth × channels (PCM), estimate FLAC/ALAC compression (50–60% of PCM), map lossy quality presets (low/medium/high/voice/music) to typical bitrates, compute file size from bitrate × duration, calculate streaming bandwidth requirement, reverse-calculate required bitrate from target file size, and score quality 0–100. Includes 7 sample rates, 5 bit depths, 4 channel layouts, 7 formats, 5 quality presets, side-by-side format comparison, text/CSV exports, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio bitrate calculator", "bitrate", "file size",
    "pcm bitrate", "flac compression", "mp3 quality",
    "streaming bandwidth", "audio quality score",
  ],
  icon: "calculator",
  requiresNetwork: false,
  seo: {
    title: "Audio Bitrate Calculator — File Size, Quality Score, Streaming | UnQTools",
    faq: [
      {
        q: "How does the audio bitrate calculator work?",
        a: "Pick your audio format (PCM/WAV, FLAC, ALAC, MP3, AAC, OGG/Vorbis, or Opus), enter the duration, and (for uncompressed PCM) pick the sample rate, bit depth, and channel count. We compute the bitrate, file size, streaming bandwidth requirement, and a quality score. For lossy formats (MP3/AAC/OGG/Opus) you select a quality preset instead — bitrate is independent of sample rate for those.",
      },
      {
        q: "How is PCM bitrate computed?",
        a: "For uncompressed PCM (WAV/AIFF): bitrate (bits per second) = sampleRate × bitDepth × channels. For CD quality (44100 Hz, 16-bit, stereo) that's 44100 × 16 × 2 = 1,411,200 bps = 1411.2 kbps. File size = bitrate × duration / 8.",
      },
      {
        q: "How are FLAC and ALAC sizes estimated?",
        a: "FLAC and ALAC are lossless codecs that typically compress to 50–60% of the equivalent PCM size. We use a 55% average ratio by default — you can adjust the compression ratio slider to match your source material (voice compresses better than complex music).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 7 sample rate presets (8 kHz – 192 kHz). (2) 5 bit depth presets (8, 16, 24, 32, 32-float). (3) 4 channel presets (mono, stereo, 5.1, 7.1). (4) 7 format presets (PCM, FLAC, ALAC, MP3, AAC, OGG, Opus). (5) 5 quality presets for lossy (low/medium/high/voice/music). (6) PCM bitrate formula. (7) FLAC/ALAC compression estimator. (8) Lossy quality → bitrate mapping table. (9) File size calculator (bitrate × duration / 8). (10) Streaming bandwidth calculator. (11) Reverse calculator (target size → required bitrate). (12) Quality score 0–100. (13) Render as text report. (14) Render as CSV. (15) History (localStorage, last 20). (16) Shareable URL. (17) Summary stats. (18) Side-by-side format comparison.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calculations happen locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
