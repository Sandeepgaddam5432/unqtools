import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-meeting-minutes-summarizer",
  name: "AI Meeting Minutes Summarizer",
  description:
    "Paste a meeting transcript (or VTT/SRT) and get structured minutes: TL;DR, discussion summary, key decisions, action items with owners and due dates, attendees, open questions, and risks. Extractive summarization runs 100% client-side — nothing uploaded. Export Markdown, copy a recap email, and save to local history.",
  category: "ai",
  keywords: [
    "meeting minutes", "transcript summarizer", "action item extractor",
    "meeting summary", "decisions tracker", "recap email",
    "vtt to minutes", "srt to minutes", "private meeting notes",
    "attendees extractor", "next steps",
  ],
  icon: "clipboard-list",
  requiresNetwork: false,
  seo: {
    title: "AI Meeting Minutes Summarizer — Transcript to Decisions & Actions | UnQTools",
    faq: [
      {
        q: "How does the meeting minutes summarizer work?",
        a: "Paste a raw transcript, speaker-tagged notes, or upload a .txt/.vtt/.srt file. The parser detects speakers, tokenizes sentences, and runs extractive summarization (scoring by sentence length, keyword frequency, position, and speaker turn) to build a TL;DR and discussion summary. Then it scans the text for decision cues ('we decided', 'agreed to', 'will go with'), action-item cues ('will', 'should', 'needs to', 'TODO'), owner mentions (@name or 'Name will'), and date expressions ('by Friday', 'next week', 'EOW'). Everything runs locally in your browser.",
      },
      {
        q: "What transcript formats are supported?",
        a: "Plain text (with or without speaker labels like 'Alice:' or 'Alice 12:34'), WebVTT (.vtt), and SubRip (.srt). The parser strips timestamps and cue identifiers, then groups consecutive lines by detected speaker. If no speaker labels are found, the tool falls back to paragraph-level summarization and shows a warning.",
      },
      {
        q: "How are action items, owners, and due dates extracted?",
        a: "Action items are detected by scanning for future-tense cues ('will', 'going to', 'needs to', 'should', 'must', 'TODO', 'action item'). Owner is detected via @mentions (e.g., '@alice'), explicit speaker attribution ('Alice will...'), or 'Name:' patterns. Due dates are matched from natural-language phrases ('by Friday', 'next Monday', 'end of week', 'EOD', 'EOW', 'tomorrow', 'next sprint') and ISO dates.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) VTT/SRT/plain-text transcript parser with speaker detection. (2) Extractive TL;DR + discussion summary with adjustable length (brief/standard/detailed). (3) Decisions extraction. (4) Action items with owner + due date NER. (5) Open questions extraction. (6) Attendees list. (7) Risks/follow-ups section. (8) Markdown export. (9) Recap-email generator (copy-ready). (10) Chunked map-reduce for long transcripts. (11) Local history (max 20). (12) Shareable URL. (13) Per-section copy buttons. (14) Honesty disclaimers (review before sending). (15) Editable output sections.",
      },
      {
        q: "Is my meeting transcript sent anywhere?",
        a: "No. All parsing, summarization, action-item extraction, and rendering run locally in your browser. Your transcript never leaves this device. History is stored in localStorage on this device only. An optional BYO-key LLM hook exists in the code, but the default template-offline path is fully on-device.",
      },
    ],
  },
  status: "done",
};
