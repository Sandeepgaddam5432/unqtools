import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-trimmer",
  name: "Video Trimmer",
  description:
    "Trim video files to a start/end timestamp range entirely in the browser. Drag-and-drop or pick a video, play it through a hidden <video> + <canvas> + MediaRecorder pipeline, and download the trimmed portion as a WebM (or MP4 where supported). Multi-format time parser (4 formats), trim validation, output-format support lookup, file-size estimator (bitrate × duration), 4 bitrate presets, 4 frame-rate presets, 4 resolution presets, 5 fade in/out presets, filename generator, history (localStorage), shareable URL, video preview before/after, and summary stats (original duration, trimmed duration, % removed, output size). 100% client-side.",
  category: "audio-video",
  keywords: [
    "video trimmer", "trim video", "cut video",
    "video clipper", "video editor", "webm",
    "media recorder", "video cutter",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Video Trimmer — Cut Video Online (WebM/MP4, Canvas+MediaRecorder) | UnQTools",
    faq: [
      {
        q: "How does the video trimmer work in the browser?",
        a: "Drop or pick a video file. We load it into a hidden <video> element, then seek to your start time and play forward to the end time while capturing each frame onto a <canvas> and piping the canvas stream (plus the original audio track) through MediaRecorder. The output is downloaded as a WebM (or MP4 where the browser supports recording it). No upload — all rendering happens locally.",
      },
      {
        q: "What time formats can I enter?",
        a: "Four formats are supported: plain seconds (e.g. 12.5), MM:SS (e.g. 01:30), MM:SS.ms (e.g. 01:30.250), and HH:MM:SS (e.g. 01:02:03). The parser auto-detects which format you used.",
      },
      {
        q: "Can I change the resolution, frame rate, and bitrate?",
        a: "Yes. Bitrate presets: low (1 Mbps), medium (2.5 Mbps), high (5 Mbps), very high (8 Mbps). Frame rate: 24, 30, 60 fps. Resolution: 480p, 720p, 1080p, or original (keeps source dimensions). Fade in/out presets: 0ms (off), 250ms, 500ms, 1s, 2s.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-format time parser (4 input formats). (2) Time formatter (MM:SS.ms + HH:MM:SS). (3) Trim validation (start < end, end ≤ duration). (4) Output format support lookup (webm/mp4 via MediaRecorder). (5) File-size estimator (bitrate × duration / 8). (6) 4 bitrate presets. (7) 4 frame-rate presets. (8) 4 resolution presets (480p/720p/1080p/original). (9) 5 fade in/out presets. (10) Filename generator (timestamped). (11) History (localStorage, last 20). (12) Shareable URL settings. (13) Drag-and-drop file input. (14) Summary stats (original duration, trimmed duration, % removed, output size). (15) Video preview before & after.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The video file you load, the captured canvas frames, and the output WebM never leave your browser. There is no upload. Trim metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
