import type { OutputAudience } from "@/lib/audience";

export type OutputType = "weekly-brief" | "lesson" | "deck";

export type OutputSectionKind = "summary" | "analysis" | "teaching" | "slide" | "watch";

export type OutputSectionTemplate = {
  id: string;
  title: string;
  kind: OutputSectionKind;
  prompt: string;
  defaultBulletLimit: number;
};

export type OutputTemplate = {
  id: OutputType;
  label: string;
  description: string;
  version: number;
  defaultAudience: OutputAudience;
  sections: OutputSectionTemplate[];
};

export const outputTemplates: Record<OutputType, OutputTemplate> = {
  "weekly-brief": {
    id: "weekly-brief",
    label: "Weekly Brief",
    description: "External weekly intelligence brief for sharing current shifts and watch items.",
    version: 1,
    defaultAudience: "executive",
    sections: [
      {
        id: "top-shifts",
        title: "Top Shifts",
        kind: "summary",
        prompt: "Lead with the strongest directional changes.",
        defaultBulletLimit: 5,
      },
      {
        id: "emerging-patterns",
        title: "Emerging Patterns",
        kind: "analysis",
        prompt: "Explain recurring tags, narratives, and correlated signals.",
        defaultBulletLimit: 5,
      },
      {
        id: "scenario-implications",
        title: "Scenarios and Implications",
        kind: "analysis",
        prompt: "Connect likely scenarios to consequences and domain impact.",
        defaultBulletLimit: 4,
      },
      {
        id: "watch-signals",
        title: "Watch Signals",
        kind: "watch",
        prompt: "List signals that would confirm, weaken, or redirect the current read.",
        defaultBulletLimit: 5,
      },
    ],
  },
  lesson: {
    id: "lesson",
    label: "Lesson",
    description: "Teaching-oriented explanation that turns current signals into reusable mental models.",
    version: 1,
    defaultAudience: "learner",
    sections: [
      {
        id: "learning-objective",
        title: "Learning Objective",
        kind: "teaching",
        prompt: "State what the audience should understand after reading.",
        defaultBulletLimit: 2,
      },
      {
        id: "core-concept",
        title: "Core Concept",
        kind: "teaching",
        prompt: "Explain the main pattern in teachable terms.",
        defaultBulletLimit: 4,
      },
      {
        id: "worked-examples",
        title: "Worked Examples",
        kind: "analysis",
        prompt: "Use concrete clusters, trends, or scenarios as examples.",
        defaultBulletLimit: 4,
      },
      {
        id: "practice-prompts",
        title: "Practice Prompts",
        kind: "teaching",
        prompt: "Provide reflection questions that help transfer the lesson.",
        defaultBulletLimit: 3,
      },
    ],
  },
  deck: {
    id: "deck",
    label: "Deck",
    description: "Slide-ready structure for presenting the current intelligence read.",
    version: 1,
    defaultAudience: "executive",
    sections: [
      {
        id: "slide-1",
        title: "Situation",
        kind: "slide",
        prompt: "Summarize the current state.",
        defaultBulletLimit: 3,
      },
      {
        id: "slide-2",
        title: "Evidence",
        kind: "slide",
        prompt: "Show the strongest evidence from clusters, trends, and narratives.",
        defaultBulletLimit: 4,
      },
      {
        id: "slide-3",
        title: "So What",
        kind: "slide",
        prompt: "Explain implications, risks, and likely consequences.",
        defaultBulletLimit: 4,
      },
      {
        id: "slide-4",
        title: "What To Watch",
        kind: "slide",
        prompt: "List watch signals and decision triggers.",
        defaultBulletLimit: 4,
      },
    ],
  },
};

export function getOutputTemplate(type: OutputType) {
  return outputTemplates[type] ?? outputTemplates["weekly-brief"];
}

export function isOutputType(value: string): value is OutputType {
  return value === "weekly-brief" || value === "lesson" || value === "deck";
}
