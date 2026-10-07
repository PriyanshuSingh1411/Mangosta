import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getReviewEligibility } from "@/app/lib/reviews";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/reviews/upload (form-data: file, productId)
 * Customer review photos. Only customers allowed to review the product
 * can upload, max 5 MB per image.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const productId = String(formData?.get("productId") ?? "");

  const eligibility = await getReviewEligibility(user, productId);
  if (!eligibility.canReview) {
    return NextResponse.json({ error: "You can't add photos for this product." }, { status: 403 });
  }

  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please choose an image file." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Photos must be smaller than 5 MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "mangosta/reviews", resource_type: "image" },
          (error, result) => {
            if (error || !result) reject(error ?? new Error("No upload result."));
            else resolve(result.secure_url);
          }
        )
        .end(buffer);
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Review photo upload error:", error);
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 500 });
  }
}
