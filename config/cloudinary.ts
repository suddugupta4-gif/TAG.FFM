import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

export function getCloudinaryConfig() {
  let cloudName = cleanEnv(
    process.env.CLOUDINARY_CLOUD_NAME || 
    process.env.CLOUDINARY_NAME || 
    process.env.CLOUD_NAME || 
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  );
  let apiKey = cleanEnv(
    process.env.CLOUDINARY_API_KEY || 
    process.env.API_KEY || 
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  );
  let apiSecret = cleanEnv(
    process.env.CLOUDINARY_API_SECRET || 
    process.env.API_SECRET
  );

  const cloudinaryUrl = cleanEnv(process.env.CLOUDINARY_URL);

  // If user provided a complete CLOUDINARY_URL string (e.g. cloudinary://key:secret@cloud_name)
  if (cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl.replace('cloudinary://', 'http://'));
      if (parsed.username && parsed.password && parsed.hostname) {
        apiKey = apiKey || parsed.username;
        apiSecret = apiSecret || parsed.password;
        cloudName = cloudName || parsed.hostname;
      }
    } catch {
      const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@([^\/\s]+)/);
      if (match) {
        apiKey = apiKey || match[1];
        apiSecret = apiSecret || match[2];
        cloudName = cloudName || match[3];
      }
    }
  }

  const isConfigured = Boolean(cloudName && apiKey && apiSecret);

  if (isConfigured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
  }

  return { isConfigured, cloudName, apiKey, apiSecret };
}

// Initial check on startup
const initial = getCloudinaryConfig();
export const isCloudinaryConfigured = initial.isConfigured;

if (initial.isConfigured) {
  console.log(`✅ Cloudinary configured successfully for cloud: "${initial.cloudName}"`);
} else {
  console.log('ℹ️ Cloudinary credentials not fully detected — using safe Base64/Data URI fallback engine for photos.');
}

export { cloudinary };

