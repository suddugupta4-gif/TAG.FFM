import { cloudinary, getCloudinaryConfig } from '../config/cloudinary.js';

export interface ProcessedImageResult {
  url: string;
  format: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}

// Detect MIME type from buffer magic bytes
function getMimeType(buffer: Buffer): string {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length > 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length > 4 && buffer.toString('utf8', 0, 5).includes('<svg')) {
    return 'image/svg+xml';
  }
  return 'image/jpeg';
}

export async function processAndUploadImage(
  fileBuffer: Buffer,
  folder: 'backgrounds' | 'players' | 'tournaments' | 'teams' = 'players',
  maxWidth: number = 800,
  quality: number = 82
): Promise<ProcessedImageResult> {
  let targetBuffer = fileBuffer;
  let detectedMime = getMimeType(fileBuffer);
  let finalFormat = detectedMime.replace('image/', '');
  let imageWidth: number | undefined;
  let imageHeight: number | undefined;

  // 1. Try Sharp compression (Safe fallback for Vercel Serverless / Container envs)
  try {
    const sharpModule = await import('sharp');
    const sharp = (sharpModule.default || sharpModule) as any;
    
    if (typeof sharp === 'function') {
      const pipeline = sharp(fileBuffer)
        .resize({
          width: maxWidth,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality });

      const compressed = await pipeline.toBuffer();
      const meta = await sharp(compressed).metadata();
      
      targetBuffer = compressed;
      detectedMime = 'image/webp';
      finalFormat = 'webp';
      imageWidth = meta.width;
      imageHeight = meta.height;
    }
  } catch (sharpError: any) {
    console.warn('ℹ️ Sharp optimization skipped/unavailable on current runtime (Vercel serverless), using raw buffer:', sharpError.message);
  }

  // 2. Check live Cloudinary configuration
  const cloudConfig = getCloudinaryConfig();

  if (cloudConfig.isConfigured) {
    try {
      const dataUri = `data:${detectedMime};base64,${targetBuffer.toString('base64')}`;
      
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: `tagfreefiremax/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      if (uploadResult && uploadResult.secure_url) {
        return {
          url: uploadResult.secure_url,
          format: uploadResult.format || finalFormat,
          width: uploadResult.width || imageWidth,
          height: uploadResult.height || imageHeight,
          sizeBytes: uploadResult.bytes || targetBuffer.length
        };
      }
    } catch (cloudErr: any) {
      console.error('⚠️ Cloudinary direct upload error, falling back to instant data URI:', cloudErr.message);
    }
  }

  // 3. Fallback: Ultra-reliable Base64 Data URI (Works in 100% of browsers and hosting platforms)
  const base64Url = `data:${detectedMime};base64,${targetBuffer.toString('base64')}`;
  return {
    url: base64Url,
    format: finalFormat,
    width: imageWidth,
    height: imageHeight,
    sizeBytes: targetBuffer.length
  };
}

