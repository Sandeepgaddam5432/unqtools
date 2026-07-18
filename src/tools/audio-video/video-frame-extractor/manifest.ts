import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-frame-extractor",
  name: "Video Frame Extractor",
  description:
    "Extract still frames from a video file entirely in the browser. Three modes: single frame at a timestamp, a sequence at multiple timestamps, or an interval (every N seconds). Output formats: PNG, JPEG, or WebP. JPEG quality presets (50/75/90/100%). Frame filename generator (frame-001.png), frame count calculator, resolution scaling (full/half/quarter), pure-JS ZIP archive builder for bundling multiple frames, text + CSV reports, history (localStorage), shareable URL, and summary stats. 100% client-side — uses HTML5 <video> seeked event and Canvas toBlob, with requestVideoFrameCallback when available.",
  category: "audio-video",
  keywords: [
    "video frame extractor", "extract frames", "video to image",
    "video to png", "video to jpeg", "frame grabber",
    "video snapshot", "frame capture", "video still",
  ],
  icon: "film",
  requiresNetwork: false,
  seo: {
    title: "Video Frame Extractor — Capture Frames as PNG/JPEG/WebP | UnQTools",
    faq: [
      {
        q: "How does the video frame extractor work?",
        a: "Drop or pick a video file. We load it into an HTML5 <video> element via an object URL. For each requested timestamp we seek the video to that time, wait for the frame to render (using requestVideoFrameCallback when available, or the seeked event as fallback), draw it to a <canvas>, and export the canvas as a PNG, JPEG, or WebP blob. Frames are then bundled into a pure-JS ZIP archive for one-click download.",
      },
      {
        q: "What extraction modes are supported?",
        a: "Three modes: (1) Single — capture one frame at a specific timestamp. (2) Sequence — capture a frame at each timestamp in a list (comma or newline separated, supports formats like 90, 01:30, 01:02:03). (3) Interval — capture a frame every N seconds using one of six presets (1s, 5s, 10s, 30s, 1min, 5min) or a custom interval.",
      },
      {
        q: "What output formats and quality options are available?",
        a: "Three formats: PNG (lossless), JPEG (lossy, smaller), WebP (modern, smaller). JPEG quality presets: 50%, 75%, 90%, 100%. You can also choose to extract at full resolution, half resolution (50%), or quarter resolution (25%) to reduce output size.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Three extraction modes (single, sequence, interval). (2) Timestamp parser (4 formats: seconds, decimal seconds, MM:SS, HH:MM:SS). (3) Timestamp list parser (comma, newline, semicolon, whitespace). (4) Six interval presets. (5) Three output format presets (PNG/JPEG/WebP). (6) Four JPEG quality presets. (7) Frame filename generator (zero-padded frame-001.png). (8) Frame count calculator for interval mode. (9) Pure-JS ZIP archive builder (STORE method, no deps). (10) Resolution calculator (full/half/quarter). (11) Render as text report. (12) Render as CSV (frame_number, timestamp, filename, size). (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (total frames, total size, avg frame size, mode). (16) Drag-and-drop file input.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The video file, frame captures, and ZIP archive never leave your browser. Seeking, canvas drawing, and blob encoding all happen locally. History metadata (file name, frame count, mode, total size) is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
