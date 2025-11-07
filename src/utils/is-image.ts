/**
 * Supported image MIME types for scanning
 */
const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
] as const;

/**
 * Checks if a MIME type represents an image format supported by Centure scanning
 * @param mimeType - The MIME type to check (optional)
 * @returns true if the MIME type is a supported image format
 */
export function isImageMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().trim();
  return IMAGE_MIME_TYPES.includes(normalized as any);
}
