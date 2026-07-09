"use client";

import { useEffect, useState } from "react";
import {
  getEffectiveImportance,
  loadImportanceFeedback,
  resetUserImportance,
  setUserImportance,
} from "@/lib/feedback";
import { Article, ImportanceFeedback } from "@/lib/types";

type ImportanceEditorProps = {
  article: Article;
  feedback?: ImportanceFeedback;
  score?: number;
  learnedAdjustment?: number;
  learningExplanation?: string | null;
  onSetImportance?: (
    article: Article,
    userImportance: 1 | 2 | 3 | 4 | 5,
  ) => void;
  onResetImportance?: (article: Article) => void;
};

const values: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

export function ImportanceEditor({
  article,
  feedback,
  score,
  learnedAdjustment = 0,
  learningExplanation,
  onSetImportance,
  onResetImportance,
}: ImportanceEditorProps) {
  const [editing, setEditing] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<ImportanceFeedback | undefined>();
  const activeFeedback = feedback ?? localFeedback;
  const effectiveImportance = getEffectiveImportance(
    article,
    activeFeedback ? { [article.id]: activeFeedback } : {},
  );
  const hasOverride = Boolean(activeFeedback);

  useEffect(() => {
    if (!feedback) {
      setLocalFeedback(loadImportanceFeedback()[article.id]);
    }
  }, [article.id, feedback]);

  const handleSet = (userImportance: 1 | 2 | 3 | 4 | 5) => {
    if (onSetImportance) {
      onSetImportance(article, userImportance);
    } else {
      const next = setUserImportance(
        article.id,
        article.importance,
        userImportance,
      );
      setLocalFeedback(next[article.id]);
    }

    setEditing(false);
  };

  const handleReset = () => {
    if (onResetImportance) {
      onResetImportance(article);
    } else {
      resetUserImportance(article.id);
      setLocalFeedback(undefined);
    }
  };

  return (
    <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 text-left sm:w-32 sm:text-right">
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            hasOverride
              ? "bg-sky-600 text-white"
              : "bg-white text-slate-700 shadow-sm"
          }`}
        >
          {effectiveImportance}/5
        </span>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="text-xs font-medium text-sky-700 hover:text-sky-900"
          aria-expanded={editing}
        >
          Edit
        </button>
      </div>

      {score !== undefined ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Score {score.toFixed(1)}
        </p>
      ) : null}

      {hasOverride ? (
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 sm:justify-end">
          <span>
            Original {article.importance}/5
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="font-medium text-slate-700 hover:text-rose-700"
          >
            Reset
          </button>
        </div>
      ) : null}

      {editing ? (
        <div
          className="mt-2 flex justify-start gap-1 sm:justify-end"
          role="radiogroup"
          aria-label={`${article.headline} importance`}
        >
          {values.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={effectiveImportance === value}
              onClick={() => handleSet(value)}
              className={`h-7 w-7 rounded-full text-xs font-semibold transition ${
                effectiveImportance === value
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}

      {learningExplanation && !hasOverride && learnedAdjustment !== 0 ? (
        <p className="mt-2 max-w-48 text-left text-[11px] leading-4 text-slate-500">
          {learningExplanation}
        </p>
      ) : null}
    </div>
  );
}
