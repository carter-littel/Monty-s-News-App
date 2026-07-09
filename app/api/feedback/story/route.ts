import { NextResponse } from "next/server";
import { updateAffinitiesFromFeedback } from "@/lib/affinity";
import { getAffinities, saveUserFeedback, updateAffinity } from "@/lib/db";
import type { StoryCluster, UserFeedbackAction } from "@/lib/types";

const actions = new Set<UserFeedbackAction>([
  "click",
  "expand",
  "boost",
  "suppress",
  "rescore",
]);

function isAction(value: unknown): value is UserFeedbackAction {
  return typeof value === "string" && actions.has(value as UserFeedbackAction);
}

function isCluster(value: unknown): value is StoryCluster {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as StoryCluster).id === "string" &&
      Array.isArray((value as StoryCluster).tags) &&
      Array.isArray((value as StoryCluster).entities),
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.clusterId !== "string" || !isAction(body.action)) {
      return NextResponse.json(
        { ok: false, error: "clusterId and action are required" },
        { status: 400 },
      );
    }

    const value = Number.isFinite(Number(body.value)) ? Number(body.value) : null;
    const feedback =
      (await saveUserFeedback({
        clusterId: body.clusterId,
        action: body.action,
        value,
      })) ?? {
        clusterId: body.clusterId,
        action: body.action,
        value,
        createdAt: new Date().toISOString(),
      };

    if (isCluster(body.cluster)) {
      const currentAffinities = await getAffinities();
      const nextAffinities = updateAffinitiesFromFeedback(
        [feedback],
        [body.cluster],
        currentAffinities,
      );

      await Promise.all(
        nextAffinities.map((affinity) =>
          updateAffinity({
            key: affinity.key,
            type: affinity.type,
            score: affinity.score,
          }),
        ),
      );
    }

    return NextResponse.json({
      ok: true,
      persisted: "id" in feedback && Boolean(feedback.id),
      feedback,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}
