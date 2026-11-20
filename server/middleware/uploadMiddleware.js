const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '..', '..', 'client', 'uploads', 'profiles');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${req.user._id}-${crypto.randomBytes(12).toString('hex')}${extension}`);
  }
});

const profilePhotoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Profile photo must be a JPG, PNG, or WebP image.'));
    }
    callback(null, true);
  }
});

module.exports = { profilePhotoUpload };
