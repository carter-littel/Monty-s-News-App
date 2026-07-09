import { NextResponse } from "next/server";

function isImportance(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.articleId !== "string" || !isImportance(body.userImportance)) {
      return NextResponse.json(
        { ok: false, error: "articleId and userImportance are required" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      feedback: {
        articleId: body.articleId,
        userImportance: body.userImportance,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}
