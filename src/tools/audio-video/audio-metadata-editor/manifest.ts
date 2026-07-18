import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "audio-metadata-editor",
  name: "Audio Metadata Editor",
  description:
    "View and edit audio file metadata entirely in the browser — ID3v2 tags for MP3, Vorbis comments for OGG / FLAC, and RIFF INFO for WAV. Drag-and-drop a file, auto-detect the format by magic bytes, parse existing fields (title, artist, album, year, track, genre, comment, copyright), edit values, and write them back. ID3v2 (MP3) and RIFF INFO (WAV) support full read + write; OGG / FLAC Vorbis comments are read-only. Includes 126 ID3v1 genre presets (Blues, Classic Rock, …, Dance Hall), case-insensitive field normalization, field length validation, text + CSV report exporters, history (localStorage), shareable URL, and summary stats. 100% client-side — no upload, no library.",
  category: "audio-video",
  keywords: [
    "audio metadata", "id3", "id3v2", "vorbis comments",
    "riff info", "mp3 tags", "wav tags", "ogg tags",
    "flac tags", "tag editor", "audio tags", "metadata editor",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "Audio Metadata Editor — ID3v2 / Vorbis / RIFF Tags | UnQTools",
    faq: [
      {
        q: "How does the audio metadata editor work?",
        a: "Drop or pick an audio file. We read its bytes and detect the format by magic bytes (ID3 for MP3, OggS for OGG, RIFF for WAV, fLaC for FLAC). We then parse the existing metadata tags into a normalized set of fields (title, artist, album, year, track, genre, comment, copyright). You can edit the fields and we write them back into the file — for MP3 we re-encode the ID3v2 header, for WAV we replace the LIST/INFO chunk. OGG and FLAC are read-only (display only) because their framing is more complex.",
      },
      {
        q: "What metadata formats are supported?",
        a: "Four formats: MP3 (ID3v2.3 / ID3v2.4 — read + write), WAV (RIFF LIST/INFO — read + write), OGG (Vorbis comments — read only), and FLAC (Vorbis comments — read only). For MP3 we parse 8 common ID3v2 frames (TIT2, TPE1, TALB, TYER, TRCK, TCON, COMM, TCOP). For WAV we parse 8 RIFF INFO fields (INAM, IART, IPRD, ICRD, ITRK, IGNR, ICMT, ICOP).",
      },
      {
        q: "What fields can I edit?",
        a: "Eight standard fields: Title, Artist, Album, Year, Track, Genre, Comment, and Copyright. Genre supports a dropdown of the 126 ID3v1 predefined genres (Blues, Classic Rock, Country, …, Dance Hall) plus free-text input. Field names are normalized case-insensitively (so 'TITLE', 'Title', and 'title' all map to the same field).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 format support (MP3, OGG, WAV, FLAC). (2) Format detector (magic bytes). (3) ID3v2 parser (8 frame types). (4) ID3v2 writer (build header + frames + padding). (5) RIFF INFO parser (8 field types). (6) RIFF INFO writer (replace LIST chunk). (7) Vorbis comment parser (OGG/FLAC, read-only). (8) Case-insensitive field name normalizer. (9) Field length validator. (10) 126 ID3v1 genre presets. (11) Text report exporter. (12) CSV exporter. (13) Timestamped filename generator. (14) History (localStorage, last 20). (15) Shareable URL settings. (16) Summary stats (total fields, modified fields, format).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The audio file you load, parsed metadata, edited fields, and re-encoded output never leave your browser. There is no upload. Metadata edit history is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
