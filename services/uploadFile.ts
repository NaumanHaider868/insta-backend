import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.RAILWAY_BUCKET_ENDPOINT,
  credentials: {
    accessKeyId: process.env.RAILWAY_BUCKET_ACCESS_KEY!,
    secretAccessKey: process.env.RAILWAY_BUCKET_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const uploadFile = async (
  fileData: Buffer,
  blobPath: string,
  contentType: string = 'image/jpeg'
) => {
  const bucketName = process.env.RAILWAY_BUCKET_NAME!;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: blobPath,
      Body: fileData,
      ContentType: contentType,
    })
  );

  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: blobPath,
    })
  );

  return {
    url: signedUrl,
    pathname: blobPath,
  };
};

export { uploadFile };
