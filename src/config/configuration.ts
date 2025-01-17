export default () => ({
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_AWS_BUCKET_NAME,
  },
  upload: {
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    tempDir: process.env.TEMP_DIR || 'tmp',
  },
}); 