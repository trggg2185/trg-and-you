import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "fs";
import fs from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicUrl
  ) {
    throw new Error("Missing Cloudflare R2 environment variables");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function createR2Client() {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function getPublicVideoUrl(r2Key: string): string {
  const { publicUrl } = getR2Config();
  const base = publicUrl.replace(/\/+$/, "");
  const cleanKey = r2Key.replace(/^\/+/, "");
  return `${base}/${cleanKey}`;
}

export async function createPresignedUploadUrl(
  r2Key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; r2Key: string }> {
  const { bucketName } = getR2Config();
  const client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: r2Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = getPublicVideoUrl(r2Key);

  return { uploadUrl, publicUrl, r2Key };
}

export async function downloadR2ObjectToFile(
  r2Key: string,
  destPath: string
): Promise<void> {
  const { bucketName } = getR2Config();
  const client = createR2Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body when downloading R2 object: ${r2Key}`);
  }

  const bodyStream = response.Body as Readable;
  await pipeline(bodyStream, createWriteStream(destPath));
}

export async function deleteR2Object(r2Key: string): Promise<void> {
  const { bucketName } = getR2Config();
  const client = createR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    })
  );
}

/** Uploads a small local file (e.g., JPEG thumbnail) to R2 and returns its public URL. */
export async function uploadFileToR2(
  r2Key: string,
  filePath: string,
  contentType: string
): Promise<string> {
  const { bucketName } = getR2Config();
  const client = createR2Client();
  const body = await fs.readFile(filePath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return getPublicVideoUrl(r2Key);
}

export interface R2StoredObject {
  key: string;
  size: number;
  lastModified: string;
}

/** Lists all objects inside the configured R2 bucket (paginated safely). */
export async function listR2Objects(prefix?: string): Promise<R2StoredObject[]> {
  const { bucketName } = getR2Config();
  const client = createR2Client();
  const objects: R2StoredObject[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ...(prefix ? { Prefix: prefix } : {}),
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    for (const item of res.Contents ?? []) {
      if (!item.Key) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: (item.LastModified ?? new Date()).toISOString(),
      });
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

/** Deletes multiple object keys from R2 cleanly. */
export async function deleteR2Objects(keys: string[]): Promise<number> {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) return 0;

  const { bucketName } = getR2Config();
  const client = createR2Client();
  let deleted = 0;

  for (let i = 0; i < uniqueKeys.length; i += 1000) {
    const batch = uniqueKeys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    deleted += batch.length;
  }

  return deleted;
}
