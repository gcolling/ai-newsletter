import { type Candidate, makeCandidate, type Origin } from "./candidate.ts";
import { makeSummary } from "./text.ts";

export const hfPapers: Origin = {
  id: "hf-papers",
  name: "Hugging Face Papers",
  section: "papers",
  weight: 1,
};

export const PAPERS_KEEP = 5;
export const PAPERS_MIN_UPVOTES = 20;

export interface DailyPaper {
  title?: string;
  summary?: string;
  publishedAt?: string;
  paper: {
    id: string;
    title?: string;
    summary?: string;
    upvotes: number;
    submittedOnDailyAt?: string;
  };
}

/** The daily list is empty on weekends, so take the last weekday before `date` (UTC). */
export function previousWeekday(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  do {
    day.setUTCDate(day.getUTCDate() - 1);
  } while (day.getUTCDay() === 0 || day.getUTCDay() === 6);
  return day.toISOString().slice(0, 10);
}

export function papersUrl(day: string): string {
  return `https://huggingface.co/api/daily_papers?date=${day}&limit=100`;
}

function isDailyPaper(value: unknown): value is DailyPaper {
  const paper = (value as Partial<DailyPaper> | null)?.paper;
  return typeof paper?.id === "string" && typeof paper.upvotes === "number";
}

export function parsePapers(json: unknown): DailyPaper[] {
  if (!Array.isArray(json)) throw new Error("unexpected daily papers response");
  return json.filter(isDailyPaper);
}

/**
 * Top papers by upvotes. The summary is the authors' abstract, never `ai_summary`: the digest
 * does not publish model-written text.
 */
export function paperCandidates(papers: DailyPaper[], day: string, summaryLength: number) {
  return papers
    .filter((p) => p.paper.upvotes >= PAPERS_MIN_UPVOTES)
    .sort((a, b) => b.paper.upvotes - a.paper.upvotes)
    .slice(0, PAPERS_KEEP)
    .map((p): Candidate => {
      const title = (p.paper.title ?? p.title ?? "").replace(/\s+/g, " ").trim();
      const abstract = p.paper.summary ?? p.summary ?? "";
      const featured = new Date(p.paper.submittedOnDailyAt ?? `${day}T00:00:00Z`);
      return makeCandidate({
        origin: hfPapers,
        title,
        url: `https://huggingface.co/papers/${p.paper.id}`,
        summary: makeSummary(title, abstract, "", summaryLength),
        publishedAt: Number.isNaN(featured.getTime()) ? new Date(`${day}T00:00:00Z`) : featured,
        paper: { upvotes: p.paper.upvotes, arxivId: p.paper.id },
      });
    });
}
