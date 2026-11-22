import { v2 as cloudinary } from 'cloudinary';

let isConfigured = false;

const ensureCloudinaryConfig = () => {
  if (isConfigured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials missing in environment variables');
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  isConfigured = true;
};

export const uploadAvatarToCloudinary = async (source, userId = 'user') => {
  if (!source) return null;

  try {
    ensureCloudinaryConfig();

    const uploadOptions = {
      folder: 'autoledger/avatars',
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { width: 256, height: 256, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
      ],
    };

    if (Buffer.isBuffer(source)) {
      return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) return reject(error);
          resolve(result?.secure_url || null);
        });
        stream.end(source);
      });
    }

    const result = await cloudinary.uploader.upload(source, uploadOptions);
    return result?.secure_url || null;
  } catch (error) {
    console.error('Cloudinary avatar upload failed:', error.message);
    return null;
  }
};