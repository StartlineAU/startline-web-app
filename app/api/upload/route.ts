import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { s3, S3_BUCKET, S3_REGION } from "@/lib/s3";
import { getOrganiserSession } from "@/lib/amplify-server";

export async function POST(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { type, contentType, filename } = await req.json() as {
    type: "logo" | "cover";
    contentType: string;
    filename: string;
  };

  if (!["logo", "cover"].includes(type)) {
    return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed." }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `uploads/${session.sub}/${type}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const fileUrl   = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

  return NextResponse.json({ uploadUrl, fileUrl });
}
