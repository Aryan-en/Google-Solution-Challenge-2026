"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Explanation } from "@/lib/api";
import { getExplanation } from "@/lib/api";

const defaultFixes = [
  {
    title: "Blind Resume Screening",
    description:
      "Remove names, gender indicators, and photos from resumes during initial screening to reduce unconscious bias.",
    impact: "High",
  },
  {
    title: "Structured Interviews",
    description:
      "Use standardized questions and scoring rubrics for all candidates to ensure consistent evaluation.",
    impact: "High",
  },
  {
    title: "Diverse Hiring Panels",
    description:
      "Include people from different backgrounds on interview panels to bring varied perspectives.",
    impact: "Medium",
  },
  {
    title: "Audit Scoring Criteria",
    description:
      "Review whether technical and interview scoring criteria inadvertently favor certain demographics.",
    impact: "High",
  },
  {
    title: "Expand Sourcing Channels",
    description:
      "Recruit from a wider range of sources including HBCUs, women-in-tech organizations, and community colleges.",
    impact: "Medium",
  },
  {
    title: "Regular Bias Audits",
    description:
      "Run HireLens analysis quarterly to track progress and catch new bias patterns early.",
    impact: "Medium",
  },
];

export default function FixesPage() {
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("explanation");
    if (stored) {
      const parsed: Explanation = JSON.parse(stored);
      setAiSuggestions(parsed.suggestions);
    }
  }, []);

  const handleLoadAI = async () => {
    setLoading(true);
    try {
      const result = await getExplanation();
      setAiSuggestions(result.suggestions);
      sessionStorage.setItem("explanation", JSON.stringify(result));
    } catch {
      // Silently fail, default fixes still shown
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Fix Suggestions</h1>
        <p className="text-muted">
          Actionable recommendations to reduce bias in your hiring process.
        </p>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="font-semibold">AI-Generated Recommendations</h2>
            <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full ml-auto">
              Gemini AI
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {aiSuggestions}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card p-6 mb-8 text-center">
          <p className="text-sm text-muted mb-3">
            Run AI analysis to get personalized recommendations based on your data.
          </p>
          <button
            onClick={handleLoadAI}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            {loading ? "Loading..." : "Generate AI Recommendations"}
          </button>
        </div>
      )}

      {/* Default best practices */}
      <h2 className="font-semibold text-lg mb-4">Best Practices</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {defaultFixes.map((fix) => (
          <div
            key={fix.title}
            className="rounded-xl border border-card-border bg-card p-5 hover:border-accent/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-sm">{fix.title}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  fix.impact === "High"
                    ? "bg-danger/10 text-danger"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {fix.impact} Impact
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {fix.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-card"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/simulator"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
        >
          Try What-If Simulator
        </Link>
      </div>
    </div>
  );
}
