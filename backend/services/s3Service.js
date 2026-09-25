const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');

const BUCKET = () => process.env.AWS_S3_BUCKET; // read lazily — dotenv is always loaded first

/**
 * Upload a Buffer to S3.
 * Uses PutObjectCommand directly (no multer-s3) so the endpoint is
 * always derived cleanly from the S3Client's configured region.
 *
 * @param {Buffer} buffer        — file contents
 * @param {string} key           — S3 object key, e.g. "uploads/1234-file.pdf"
 * @param {string} contentType   — MIME type, e.g. "application/pdf"
 * @returns {Promise<string>}    — the S3 object key
 */
const uploadToS3 = async (buffer, key, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });
    await s3Client.send(command);
    return key;
};

/**
 * Download an S3 object into a Buffer.
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
const downloadFromS3 = async (key) => {
    const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
    const response = await s3Client.send(command);

    return new Promise((resolve, reject) => {
        const chunks = [];
        response.Body.on('data', (chunk) => chunks.push(chunk));
        response.Body.on('end', () => resolve(Buffer.concat(chunks)));
        response.Body.on('error', reject);
    });
};

/**
 * Delete an S3 object by key.
 * @param {string} key
 */
const deleteFromS3 = async (key) => {
    const command = new DeleteObjectCommand({ Bucket: BUCKET(), Key: key });
    await s3Client.send(command);
};

/**
 * Build the public HTTPS URL for an S3 object.
 * @param {string} key
 * @returns {string}
 */
const getS3Url = (key) => {
    return `https://${BUCKET()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

module.exports = { uploadToS3, downloadFromS3, deleteFromS3, getS3Url };
