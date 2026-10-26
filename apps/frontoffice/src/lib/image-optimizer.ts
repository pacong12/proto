/**
 * Client-side image compression and conversion utility.
 * Automatically resizes images to standard token dimensions (max 512x512)
 * and encodes to WebP format for fast transfer and minimal storage footprint.
 */

export interface ProcessedImageResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export async function compressAndConvertToWebp(
  file: File,
  maxDimension = 512,
  quality = 0.85,
): Promise<ProcessedImageResult> {
  // If already SVG, return as is (SVG is vector and must not be rasterized)
  if (file.type === 'image/svg+xml') {
    const dataUrl = await fileToDataUrl(file);
    return { file, dataUrl, width: maxDimension, height: maxDimension };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Scale down proportionally if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D canvas context for image processing'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Encode as image/webp; browsers without a WebP encoder fall back to PNG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          // Safari and every iOS browser hand back a PNG: label the file with what was
          // actually encoded, since the API checks the bytes against the type.
          const type = blob.type || 'image/png';
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const outputName = `${baseName}.${type.split('/')[1]}`;
          const convertedFile = new File([blob], outputName, { type });
          const dataUrl = canvas.toDataURL(type, quality);

          resolve({
            file: convertedFile,
            dataUrl,
            width,
            height,
          });
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing'));
    };

    img.src = objectUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
