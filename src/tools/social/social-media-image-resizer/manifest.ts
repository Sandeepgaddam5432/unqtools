import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "social-media-image-resizer",
  name: "Social Media Image Resizer",
  description:
    "Resize images for Instagram, Twitter/X, Facebook, LinkedIn, YouTube, and TikTok. 18 platform/format presets (square, portrait, story, landscape, header, cover, thumbnail, avatar), 3 output formats (jpeg/png/webp), 4 quality presets, 2 crop modes (fill/cover or fit/contain), batch processing, image metadata extraction, file-size estimator, orientation + aspect-ratio detection, quality scorer, ZIP download, CSV/text reports, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "image resizer", "social media image", "instagram image size",
    "twitter image size", "facebook image size", "linkedin image size",
    "youtube thumbnail", "tiktok video size", "resize image",
    "image dimensions", "image crop",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Social Media Image Resizer — Instagram, Twitter, Facebook, LinkedIn | UnQTools",
    faq: [
      {
        q: "How does the image resizer work?",
        a: "Upload an image, pick one or more target platforms (Instagram, Twitter, Facebook, LinkedIn, YouTube, TikTok), and the tool generates a resized image for each platform/format combo using the Canvas API. Choose fill (cover crop) or fit (contain with padding) crop mode, output format (jpeg/png/webp), and quality (50/75/90/100%). Download individual images or all as a ZIP archive.",
      },
      {
        q: "Which platform presets are included?",
        a: "18 platform/format presets across 6 platforms: Instagram (square 1080×1080, portrait 1080×1350, story 1080×1920, landscape 1080×566), Twitter (post 1200×675, header 1500×500, avatar 400×400), Facebook (cover 1640×856, post 1200×630, avatar 180×180), LinkedIn (cover 1584×396, post 1200×627, avatar 400×400), YouTube (thumbnail 1280×720, channel art 2560×1440, avatar 800×800), and TikTok (video 1080×1920, avatar 200×200).",
      },
      {
        q: "What crop modes are supported?",
        a: "Two modes: fill (cover) crops the source to fill the target aspect ratio without distortion — excess pixels are trimmed. Fit (contain) letterboxes the source inside the target with padding (background color) so the whole image is visible. Both preserve the source aspect ratio without stretching.",
      },
      {
        q: "Can I batch-process multiple platforms at once?",
        a: "Yes. Select multiple platforms and formats — the tool generates a separate output for each. Each output is shown as a thumbnail with its dimensions, format, and estimated file size. Download all as a single ZIP archive (pure-JS STORE-method ZIP builder, no external dependencies).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 18 platform/format size presets (built-in). (2) 6 platform presets (IG, Twitter, FB, LinkedIn, YouTube, TikTok). (3) 3 output formats (jpeg, png, webp). (4) 4 quality presets (50/75/90/100%). (5) 2 crop modes (fill/cover, fit/contain). (6) Image metadata extractor (width, height, file size, format). (7) File-size estimator (dimensions × bitDepth × channels / 8). (8) Render as text report (per platform/format). (9) Render as CSV. (10) Copy + download (individual + ZIP). (11) History (localStorage, last 20). (12) Shareable URL (encode settings in hash). (13) Summary stats (total outputs, total estimated size, by platform). (14) Image orientation detector (portrait/landscape/square). (15) Aspect-ratio calculator. (16) Quality scorer (resolution × format). (17) Batch processing (multiple platforms at once). (18) Per-platform presets grouped for quick selection.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All image resizing runs locally in your browser via the Canvas API. Images never leave your device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
