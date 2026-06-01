'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MAX_IMAGES = 4;

export interface PendingImage {
  id: string;
  /** Raw base64 (no data: prefix) — what the Anthropic API wants. */
  base64: string;
  mediaType: string;
  /** Full data URL for <img> previews. */
  preview: string;
}

/** Read a File into a PendingImage (base64 + preview data URL). */
export function readImageFile(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve({
        id: crypto.randomUUID(),
        base64,
        mediaType: file.type || 'image/png',
        preview: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({
  images,
  onAddFiles,
  onRemove,
  disabled,
}: {
  images: PendingImage[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const atMax = images.length >= MAX_IMAGES;

  return (
    <>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative h-16 w-16 overflow-hidden rounded-md border border-border"
            >
              <Image
                src={img.preview}
                alt="attachment"
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background/80 text-faint hover:text-red"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || atMax}
        title={atMax ? `Max ${MAX_IMAGES} images` : 'Attach images'}
        className={cn(
          'grid h-9 w-9 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          (disabled || atMax) && 'cursor-not-allowed opacity-40 hover:bg-transparent'
        )}
      >
        <ImagePlus className="h-4 w-4" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onAddFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </>
  );
}
