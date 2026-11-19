import { NextRequest, NextResponse } from "next/server";
import { CopyObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PENDING_PREFIX, servedKeyFor, uploadOwner } from "@/lib/upload-access";
import { matchesMagicBytes } from "@/lib/upload-magic-bytes";
import { TYPE_MIMES, isUploadType } from "@/lib/upload-limits";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL, UPLOADS_USE_S3 } from "@/lib/s3";
import { rateLimit } from "@/lib/rate-limit";

// Direct-to-S3 means the server never sees the bytes on their way past, so the
// magic-byte check that /api/upload does inline has to happen after the fact.
// A ranged GET of the first few bytes is enough to tell a real JPEG from a
// payload wearing its Content-Type, and anything that fails is deleted before
// its URL is ever handed back. Without this step a signed POST would be a way
// to park arbitrary content in the bucket under an image content type.
const MAGIC_BYTE_RANGE = "bytes=0-15";

export async function POST(req: NextRequest) {
  const body: { key?: unknown; type?: unknown; contentType?: unknown } = await req
    .json()
    .catch(() => ({}));
  const { key, type, contentType } = body;
  if (typeof key !== "string" || !isUploadType(type) || typeof contentType !== "string") {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const session = await uploadOwner(type);
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  // Deliberately far looser than the presign limit. By the time the browser
  // calls this the file is already in the bucket, so a 429 here would strand an
  // object that nothing will ever verify, return or delete. At four times the
  // signing rate it cannot fire for a caller uploading legitimately, and it
  // still stops someone replaying this route to make us issue an S3 GetObject
  // per request against keys that do not exist.
  const blocked = await rateLimit(req, {
    prefix: "upload-complete",
    limit: 120,
    windowSeconds: 60,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  if (!UPLOADS_USE_S3) {
    return NextResponse.json({ error: "Direct uploads are not configured." }, { status: 400 });
  }

  if (!TYPE_MIMES[type].includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed for this upload." }, { status: 400 });
  }
  // The presign route keys every object under the caller's own id in the
  // pending prefix. Re-deriving that here stops anyone naming another caller's
  // object, and this route only ever deletes pending objects, never a served
  // file a listing already uses.
  const filename = key.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(filename) || key !== `${PENDING_PREFIX}/${session.sub}/${type}/${filename}`) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  let head: Uint8Array;
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key, Range: MAGIC_BYTE_RANGE })
    );
    head = (await res.Body?.transformToByteArray()) ?? new Uint8Array();
  } catch (err) {
    // The object should exist: the browser only calls this after S3 accepted
    // the POST. A miss means the upload was abandoned or the key is wrong.
    console.error("Upload verify: could not read object", { key }, err);
    return NextResponse.json({ error: "Upload could not be verified. Please try again." }, { status: 400 });
  }

  const discard = () =>
    s3
      .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      .catch(err => console.error("Upload verify: could not delete pending object", { key }, err));

  if (!matchesMagicBytes(Buffer.from(head), contentType)) {
    await discard();
    return NextResponse.json({ error: "File content does not match its type." }, { status: 400 });
  }

  // Copy the checked object to where the CDN serves it. The type and, for a
  // PDF, a download disposition are set by us here, not taken from the upload.
  const servedKey = servedKeyFor(key);
  try {
    await s3.send(new CopyObjectCommand({
      Bucket: S3_BUCKET,
      Key: servedKey,
      CopySource: `${S3_BUCKET}/${encodeURI(key)}`,
      MetadataDirective: "REPLACE",
      ContentType: contentType,
      ...(type === "document" ? { ContentDisposition: "attachment" } : {}),
    }));
  } catch (err) {
    console.error("Upload verify: could not publish object", { key }, err);
    return NextResponse.json({ error: "Upload could not be saved. Please try again." }, { status: 500 });
  }
  await discard();

  return NextResponse.json({ fileUrl: `${S3_PUBLIC_BASE_URL}/${servedKey}` });
}
