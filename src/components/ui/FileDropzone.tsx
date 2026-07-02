/**
 * FileDropzone — drag-and-drop file upload, accessible.
 * Used by Image Compressor and any future file-handling tool.
 */
import { useRef, useState } from "preact/hooks";
import { UploadCloud } from "lucide-preact";

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  class?: string;
}

export function FileDropzone({
  onFiles,
  accept = "*/*",
  multiple = false,
  label = "Drop files here, or click to select",
  hint,
  class: cls,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  }

  function onInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files) onFiles(Array.from(input.files));
    input.value = ""; // allow re-selecting the same file
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabindex={0}
      class={`unq-card duration-normal cursor-pointer p-8 text-center transition-all ${
        dragActive
          ? "scale-[1.01] border-unq-accent bg-unq-accent-subtle"
          : "hover:border-unq-border-strong hover:bg-unq-surface-hover"
      } ${cls ?? ""}`}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        class="sr-only"
        onChange={onInput}
      />
      <div class="flex flex-col items-center gap-3">
        <div
          class={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            dragActive
              ? "bg-unq-accent text-unq-accent-contrast"
              : "bg-unq-surface-hover text-unq-text-muted"
          }`}
        >
          <UploadCloud size={22} />
        </div>
        <p class="text-sm font-medium">{label}</p>
        {hint && <p class="text-xs text-unq-text-muted">{hint}</p>}
      </div>
    </div>
  );
}
