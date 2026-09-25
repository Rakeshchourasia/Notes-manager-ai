const { S3Client } = require('@aws-sdk/client-s3');

/**
 * AWS S3 Client — configured from environment variables.
 *
 * Required env vars (set in .env):
 *   AWS_REGION             e.g. "ap-south-1"
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_BUCKET          e.g. "my-notes-manager-uploads"
 *
 * NOTE: This file is loaded AFTER dotenv.config() in server.js,
 * so all process.env values are guaranteed to be populated.
 */

// Validate required vars at startup so errors surface immediately
const requiredVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'];
for (const v of requiredVars) {
    if (!process.env[v] || process.env[v].includes('your_')) {
        console.warn(`⚠️  [S3] Missing or placeholder env var: ${v}`);
    }
}

console.log(`[S3] Initialising client → region: ${process.env.AWS_REGION}, bucket: ${process.env.AWS_S3_BUCKET}`);

const s3Client = new S3Client({
    region: process.env.AWS_REGION,          // must match bucket's actual region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    // Force path-style only if needed (leave off for standard virtual-hosted style)
    // forcePathStyle: false,
});

module.exports = s3Client;
