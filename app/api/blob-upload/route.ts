// Vercel Blob client-upload token endpoint.
//
// The browser calls @vercel/blob/client `upload()` which POSTs to this
// route to obtain a short-lived token, then uploads the file directly to
// Vercel's blob storage (bypassing this serverless function for the heavy
// payload).
//
// We restrict:
//   - file types: PNG / JPEG / JSON only
//   - max size: 50 MB per file (a single comic panel image)
//   - upload paths: only under share/* so the bucket can't be used for
//     arbitrary content
//
// Required env: BLOB_READ_WRITE_TOKEN (auto-provisioned on Vercel when
// Blob is added; for local dev use `vercel env pull`).

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("share/")) {
          throw new Error("Path must be under share/");
        }
        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/json",
          ],
          maximumSizeInBytes: MAX_FILE_BYTES,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {
        // No-op for now. Could log analytics or update a KV index.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Most common dev error: missing BLOB_READ_WRITE_TOKEN
    if (/BLOB_READ_WRITE_TOKEN/.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Vercel Blob 토큰이 설정되지 않았습니다. 로컬 dev에서는 `vercel env pull`로 가져오거나, 프로젝트 Settings → Storage에서 Blob 활성화 후 환경변수를 추가하세요.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
