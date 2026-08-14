import sharp from 'sharp';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

export interface ProcessedImageResult {
  url: string;
  format: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}

export async function processAndUploadImage(
  fileBuffer: Buffer,
  folder: 'backgrounds' | 'players' | 'tournaments' | 'teams' = 'players',
  maxWidth: number = 800,
  quality: number = 82
): Promise<ProcessedImageResult> {
  try {
    // 1. Sharp Image Compression & Resizing
    let pipeline = sharp(fileBuffer)
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality });

    const compressedBuffer = await pipeline.toBuffer();
    const metadata = await sharp(compressedBuffer).metadata();

    // 2. Cloudinary Upload if configured
    if (isCloudinaryConfigured) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `tagfreefiremax/${folder}`,
            resource_type: 'image',
            format: 'webp'
          },
          (error, result) => {
            if (error || !result) {
              console.error('Cloudinary upload error, using data-uri fallback:', error);
              const base64 = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
              return resolve({
                url: base64,
                format: 'webp',
                width: metadata.width,
                height: metadata.height,
                sizeBytes: compressedBuffer.length
              });
            }
            resolve({
              url: result.secure_url,
              format: result.format || 'webp',
              width: result.width,
              height: result.height,
              sizeBytes: result.bytes || compressedBuffer.length
            });
          }
        );

        uploadStream.end(compressedBuffer);
      });
    }

    // 3. Fallback: Base64 data URI (guaranteed to render immediately in all browsers without extra hosting setup)
    const base64Url = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
    return {
      url: base64Url,
      format: 'webp',
      width: metadata.width,
      height: metadata.height,
      sizeBytes: compressedBuffer.length
    };
  } catch (err: any) {
    console.error('Image processing failed:', err);
    throw new Error(`Image compression failed: ${err.message}`);
  }
}
