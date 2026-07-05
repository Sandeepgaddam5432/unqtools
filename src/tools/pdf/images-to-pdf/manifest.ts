import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "images-to-pdf",
  name: "Images to PDF",
  description:
    "Convert JPG or PNG images into a single PDF. Control page size, orientation, and margins. Reorder images before converting. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "images to pdf",
    "jpg to pdf",
    "png to pdf",
    "photos to pdf",
    "picture to pdf",
    "image converter pdf",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Images to PDF Online — JPG, PNG to PDF Converter | UnQTools",
    faq: [
      {
        q: "Are my images uploaded to a server?",
        a: "No. Conversion happens 100% in your browser — images never leave your device, and it works offline.",
      },
      {
        q: "Which image formats are supported?",
        a: "JPEG and PNG. For other formats like WebP or GIF, convert them to PNG first using any image editor.",
      },
      {
        q: "Can I control the page size and margins?",
        a: "Yes. Choose from A4, Letter, or fit-to-image page sizes, select portrait or landscape, and set margin size (none, small, medium, large).",
      },
      {
        q: "Can I change the order of images in the output PDF?",
        a: "Yes. Use the up/down arrows to reorder images before converting.",
      },
    ],
  },
  status: "done",
};
