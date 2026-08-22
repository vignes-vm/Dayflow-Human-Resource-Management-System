import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { ApiError } from "@/middleware/errorHandler.js";

// ---------------------------------------------------------------------------
// Allowed MIME types per upload context
// ---------------------------------------------------------------------------

const AVATAR_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Ensure upload directories exist
// ---------------------------------------------------------------------------

const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
const avatarDir = path.join(uploadDir, "avatars");
const documentDir = path.join(uploadDir, "documents");

for (const dir of [avatarDir, documentDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Storage engines — server-generated filenames, no client input reaches disk
// ---------------------------------------------------------------------------

function makeStorage(dest: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  });
}

// ---------------------------------------------------------------------------
// Multer instances
// ---------------------------------------------------------------------------

export const avatarUpload = multer({
  storage: makeStorage(avatarDir),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          "INVALID_FILE_TYPE",
          "Avatar must be a JPEG, PNG, WebP or GIF image",
        ) as unknown as null,
        false,
      );
    }
  },
});

export const documentUpload = multer({
  storage: makeStorage(documentDir),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (DOCUMENT_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          "INVALID_FILE_TYPE",
          "Document must be a PDF, Word document, or image",
        ) as unknown as null,
        false,
      );
    }
  },
});
