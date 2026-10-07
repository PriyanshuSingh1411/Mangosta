import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { ReviewVoteError, toggleHelpfulVote } from "@/app/lib/reviews";

/** POST /api/reviews/:id/helpful → adds or removes the customer's vote. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to vote." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await toggleHelpfulVote(id, user.id);
    if (!result) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReviewVoteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
