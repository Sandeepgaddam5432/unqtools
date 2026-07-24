/**
 * Morse Code Translator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "morse-code-translator",
  name: "Morse Code Translator",
  description:
    "Translate text to Morse code and back. ITU standard, audio playback, adjustable WPM speed, and 10+ extras. 100% private.",
  category: "text",
  keywords: ["morse code", "translator", "translator", "dit dah", "sos", "audio", "itu"],
  icon: "radio",
  requiresNetwork: false,
  seo: {
    title: "Morse Code Translator — Text ↔ Morse + Audio Playback | UnQTools",
    faq: [
      { q: "What's the standard for Morse code?", a: "ITU-R M.1677-1 standard: letters A-Z, digits 0-9, common punctuation (.,?!:/=&'\"+-;_@$). International Morse uses dit (.) and dah (-), with letter spacing = 3 dits, word spacing = 7 dits." },
      { q: "What extras does this tool have?", a: "Extras: (1) Text → Morse, (2) Morse → text, (3) ITU standard alphabet + punctuation, (4) Audio playback via Web Audio API, (5) WPM speed control (5-40), (6) Pitch (Hz) control, (7) Volume control, (8) Visual dit/dah flasher, (9) Copy + download, (10) Show character-by-character breakdown, (11) Reverse mode toggle, (12) Support for prosigns (SOS = ...---...), (13) Sound on click, (14) Phonetic alphabet display alongside." },
    ],
  },
  status: "done",
};
