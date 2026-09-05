import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/mkv',
];

const maxVideoSizeMb = process.env.MAX_VIDEO_SIZE_MB
  ? parseInt(process.env.MAX_VIDEO_SIZE_MB, 10)
  : 100;
const MAX_VIDEO_SIZE = maxVideoSizeMb * 1024 * 1024;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`));
    }
  },
});

const uploadVideo = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.fieldname === 'video') {
      if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid video type. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}`));
      }
    } else if (file.fieldname === 'thumbnail') {
      if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid thumbnail type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`));
      }
    } else {
      cb(null, true);
    }
  },
});

export { upload, uploadVideo };
