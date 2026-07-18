import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-reverser",
  name: "Audio Reverser",
  description:
    "Reverse audio playback — flip the sample buffer end-to-start entirely in the browser. Drag-and-drop or pick a file, decode with Web Audio API, choose a reverse mode (full buffer / per-channel / segment-based / interleaved-stereo), apply click-preventing fade in/out at boundaries, and re-encode as a 16-bit PCM WAV. Pure-JS reverse + zero-crossing click detector, segment presets (1/2/4/8/16 segments), time & file-size estimator, audio preview before/after, history (localStorage), shareable URL, summary stats. 100% client-side.",
  category: "audio-video",
  keywords: [
    "audio reverser", "reverse audio", "backmasking",
    "audio backwards", "flip audio", "audio editor",
    "wav encoder", "pcm", "riff",
  ],
  icon: "rewind",
  requiresNetwork: false,
  seo: {
    title: "Audio Reverser — Play Audio Backwards Online (WAV Encoder) | UnQTools",
    faq: [
      {
        q: "How does the audio reverser work?",
        a: "Drop or pick an audio file. We decode it with the Web Audio API into raw PCM samples per channel. Then we reverse the Float32Array for each channel (end-to-start) and re-encode the result as a 16-bit PCM WAV. The reversed file plays the original audio backwards.",
      },
      {
        q: "What reverse modes are supported?",
        a: "Four modes: (1) Full — reverse the entire buffer end-to-start. (2) Per-channel — reverse each channel independently (same result as Full for typical audio, but exposed for transparency). (3) Segment — split the buffer into N equal segments (1, 2, 4, 8, or 16) and reverse each segment individually, keeping the segment order intact. (4) Interleaved — reverse an interleaved stereo stream (rarely needed but supported).",
      },
      {
        q: "What about clicks at the boundaries?",
        a: "Reversing audio can place a non-zero sample at the start or end of a segment, causing an audible click. The tool detects zero-crossings at segment boundaries and warns you, plus applies an optional fade in/out (default 5 ms) at the start/end of each segment to suppress clicks.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Full reverse (entire buffer). (2) Per-channel reverse. (3) Segment reverse (split into N segments, reverse each). (4) Interleaved reverse (for stereo). (5) Fade in/out generator (avoid clicks). (6) Click detector (zero-crossing analysis at boundaries). (7) Time calculator (unchanged duration). (8) File-size estimator. (9) Pure-JS 44-byte RIFF WAV encoder (16-bit PCM). (10) Timestamped filename generator. (11) History (localStorage, last 20). (12) Shareable URL settings. (13) Drag-and-drop file input. (14) Summary stats (input/output size, channels, segments). (15) Segment presets (1, 2, 4, 8, 16 segments).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, decoded samples, and output WAV never leave your browser. There is no upload. Reverse metadata in history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
