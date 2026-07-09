"use client";

type TagProps = {
  label: string;
  active?: boolean;
  onClick?: (tag: string) => void;
};

export function Tag({ label, active = false, onClick }: TagProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(label)}
      className={`tag-pill ${active ? "tag-pill-active" : ""}`}
    >
      #{label}
    </button>
  );
}
