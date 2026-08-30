import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { idParamsSchema } from '../../shared/index.js';
import { attachmentsDir } from '../config/paths.js';
import { prisma } from '../db/prisma.js';
import { auth, isWriterOrModerator } from '../middleware/auth.js';
import { unlinkStoredFile } from '../utils/stored-files.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(attachmentsDir, { recursive: true });
    callback(null, attachmentsDir);
  },
  filename: (_req, file, callback) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${file.fieldname}-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Error: Only images and PDFs are allowed'));
    }
  },
});

/**
 * @route POST /api/attachments
 * @desc Upload a single file, returning an unlinked attachment reference for later use on a post.
 * @access Writer, Moderator, or Admin
 */
router.post('/', auth, isWriterOrModerator, upload.single('attachment'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file was uploaded' });
  try {
    const attachment = await prisma.attachment.create({
      data: {
        postId: null,
        filename: file.filename,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
      select: { id: true, filename: true },
    });
    return res.status(201).json(attachment);
  } catch (error) {
    unlinkStoredFile(file.filename);
    console.error('Error uploading attachment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/attachments/:id
 * @desc Delete an attachment that has not yet been linked to a post.
 * @access Writer, Moderator, or Admin
 */
router.delete('/:id', auth, isWriterOrModerator, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: params.id },
      select: { filename: true, postId: true },
    });
    if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
    if (attachment.postId !== null) return res.status(403).json({ message: 'Attachment is already linked to a post' });
    const deleted = await prisma.attachment.deleteMany({
      where: { id: params.id, postId: null },
    });
    if (deleted.count === 0) {
      return res.status(403).json({ message: 'Attachment is already linked to a post' });
    }
    unlinkStoredFile(attachment.filename);
    return res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
