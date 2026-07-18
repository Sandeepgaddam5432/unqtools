import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-metadata-viewer",
  name: "Video Metadata Viewer",
  description:
    "Inspect video file metadata entirely in the browser. Drag-and-drop a video (mp4, webm, ogg, mov, avi, mkv, flv) and read container, codec, resolution, frame rate, duration, bitrate, audio tracks, and more. Pure-JS file-type detector (magic bytes + extension), MIME type lookup, codec name lookup (H.264, VP9, AV1, AAC, Opus, Vorbis), bitrate calculator + formatter (bps/kbps/Mbps/Gbps), file size formatter, duration formatter (HH:MM:SS.ms), aspect ratio calculator, resolution labeler (Full HD, 4K, 8K), 8 common resolution presets, 10 frame-rate presets, container/codec compatibility checker, text + CSV reports, history (localStorage), shareable URL, and summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "video metadata", "video info", "video inspector",
    "codec", "resolution", "bitrate", "frame rate",
    "mp4", "webm", "mov", "mkv", "avi",
  ],
  icon: "file-video",
  requiresNetwork: false,
  seo: {
    title: "Video Metadata Viewer — Inspect Codec, Resolution, Bitrate | UnQTools",
    faq: [
      {
        q: "How does the video metadata viewer work?",
        a: "Drag-and-drop or pick a video file. We use the HTML5 <video> element's loadedmetadata event to read resolution (videoWidth/videoHeight), duration, and the file's MIME type. We then detect the container and codec from the file's magic bytes and extension, compute the bitrate from file size × 8 / duration, derive the aspect ratio, label the resolution (e.g. Full HD 1080p, 4K, 8K), and check which containers are compatible with the detected codecs.",
      },
      {
        q: "What video formats are supported?",
        a: "Seven containers are recognized by the file-type detector: MP4, WebM, OGG, MOV, AVI, MKV, and FLV. Magic-byte detection is used where possible (ftyp for MP4/MOV, EBML for WebM/MKV, RIFF for AVI, FLV for FLV, OggS for OGG) and falls back to file extension. Codec names are looked up for H.264/AVC, H.265/HEVC, VP8, VP9, AV1, AAC, Opus, Vorbis, and MP3.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) File type detector (7 formats with magic bytes). (2) MIME type lookup. (3) Codec name lookup (9+ codecs). (4) Bitrate calculator (size × 8 / duration). (5) Bitrate formatter (bps/kbps/Mbps/Gbps). (6) File size formatter (B/KB/MB/GB). (7) Duration formatter (HH:MM:SS.ms). (8) Aspect ratio calculator (16:9, 4:3, 21:9, etc.). (9) Resolution labeler (Full HD, 4K, 8K). (10) 8 common resolution presets (240p–8K). (11) 10 frame rate presets (23.976–240). (12) Container/codec compatibility checker. (13) Render as text report. (14) Render as CSV. (15) History (localStorage, last 20). (16) Shareable URL. (17) Summary stats card.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The video file is loaded entirely in your browser via an object URL and the HTML5 <video> element. No bytes are uploaded to any server. History metadata (file name, size, codec, resolution) is stored in localStorage on this device only.",
      },
      {
        q: "Is my data sent around?",
        a: "No. Everything stays on your device. The file is read locally, metadata is read from the <video> element, and history is kept in your browser's localStorage. There is no network call at any point.",
      },
    ],
  },
  status: "done",
};
