/**
 * Image upload route.
 *
 *   POST /upload   (multipart/form-data, field: "file")
 *     -> 201 { url, thumbUrl, filename, bytes, originalBytes }
 *
 * The image is processed to WebP (full q82 + a 400px thumbnail q80) by
 * StorageService. `url` is the full image (stored as the product's imageUrl);
 * `thumbUrl` is additive and also derivable from `url`.
 *
 * Optional `?oldImageUrl=/uploads/products/<old>` deletes the previous image
 * (and its thumbnail) after the new one is stored (used when replacing).
 *
 * Validation (mime / extension / size) and all filesystem work live in
 * StorageService — the route only orchestrates.
 */
import type { FastifyPluginAsync } from 'fastify';
import { StorageService, UploadValidationError, MAX_BYTES } from '../services/storage.ts';

interface UploadQuery {
  oldImageUrl?: string;
}

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  const storage = new StorageService();

  fastify.post<{ Querystring: UploadQuery }>('/upload', async (request, reply) => {
    let data;
    try {
      data = await request.file();
    } catch (err) {
      // @fastify/multipart throws if the stream exceeds limits.fileSize, etc.
      fastify.log.warn(err, 'multipart parse failed');
      return reply
        .code(400)
        .send({ error: 'Bad Request', message: 'Invalid multipart upload' });
    }

    if (!data) {
      return reply
        .code(400)
        .send({ error: 'Bad Request', message: 'No file provided (field "file")' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      return reply
        .code(413)
        .send({ error: 'Payload Too Large', message: `File exceeds ${MAX_BYTES} bytes` });
    }

    try {
      const saved = await storage.saveImage({
        buffer,
        mimetype: data.mimetype,
        filename: data.filename,
      });

      // Replace: delete the previous local image if one was provided.
      const oldImageUrl = request.query.oldImageUrl;
      if (oldImageUrl) {
        await storage.deleteByUrl(oldImageUrl);
      }

      return reply.code(201).send(saved);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return reply.code(400).send({ error: 'Bad Request', message: err.message });
      }
      fastify.log.error(err, 'image upload failed');
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Failed to store image' });
    }
  });
};

export default uploadRoute;
