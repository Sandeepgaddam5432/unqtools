import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-compressor",
  name: "Video Compressor",
  description:
    "Compress video files entirely in the browser — reduce file size by lowering bitrate, resolution, and frame rate. Drag-and-drop or pick a video, play it through a hidden <video> + <canvas> + MediaRecorder pipeline at the chosen settings, and download the smaller output as WebM (or MP4 where supported). Bitrate presets (4: 500kbps to 5Mbps), resolution presets (5: 240p to 1080p), aspect-ratio-aware resolution calculator, frame-rate presets (3), compression ratio calculator, file-size estimator, quality score calculator (0-100), format support lookup (webm/mp4), codec support lookup (VP8/VP9/H.264/AV1), filename generator, history (localStorage), shareable URL, video preview before/after, and summary stats (input size, output size, % reduction, compression ratio, quality score). 100% client-side.",
  category: "audio-video",
  keywords: [
    "video compressor", "compress video", "reduce video size",
    "video shrinker", "webm compressor", "video optimizer",
    "video size reducer", "video encoding",
  ],
  icon: "minimize-2",
  requiresNetwork: false,
  seo: {
    title: "Video Compressor — Reduce Video File Size Online (WebM/MP4) | UnQTools",
    faq: [
      {
        q: "How does the video compressor work in the browser?",
        a: "Drop or pick a video file. We load it into a hidden <video> element, then play it through a <canvas> at your chosen resolution while MediaRecorder captures the canvas stream (plus the original audio track) at your chosen bitrate and frame rate. The output is downloaded as a WebM (or MP4 where the browser supports recording it). No upload — all encoding happens locally.",
      },
      {
        q: "What bitrate / resolution / frame rate should I pick?",
        a: "Bitrate presets range from 500 kbps (very low, smallest file) to 5 Mbps (high, near-original). Resolution presets: 240p, 360p, 480p, 720p, 1080p — the width is computed from the source aspect ratio. Frame rate: 24, 30, or 60 fps. Lowering any of these three reduces file size at the cost of visual quality.",
      },
      {
        q: "How is the compression ratio calculated?",
        a: "Compression ratio = input file size ÷ output file size. A ratio of 4.0 means the output is 4× smaller than the input. The percentage reduction is computed as (input − output) ÷ input × 100. Both are shown in the summary stats after compression finishes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 bitrate presets (500kbps to 5Mbps). (2) 5 resolution presets (240p to 1080p). (3) Aspect-ratio-aware resolution calculator. (4) 3 frame-rate presets (24/30/60). (5) Compression ratio calculator (input ÷ output). (6) File-size estimator (bitrate × duration / 8). (7) Quality score calculator (0-100, based on bitrate × resolution). (8) Format support lookup (webm/mp4 via MediaRecorder). (9) Codec support lookup (VP8, VP9, H.264, AV1). (10) Filename generator (timestamped). (11) History (localStorage, last 20). (12) Shareable URL settings. (13) Drag-and-drop file input. (14) Summary stats (input size, output size, % reduction, compression ratio, quality score). (15) Video preview before & after.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The video file you load, the captured canvas frames, and the output WebM/MP4 never leave your browser. There is no upload. Compression metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
