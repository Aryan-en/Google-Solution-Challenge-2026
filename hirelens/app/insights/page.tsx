"use client";

import { useState } from "react";
import Link from "next/link";
import { getExplanation } from "@/lib/api";
import type { Explanation } from "@/lib/api";

export default function InsightsPage() {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getExplanation();
      setExplanation(result);
      sessionStorage.setItem("explanation", JSON.stringify(result));
    } catch {
      setError("Failed to generate insights. Make sure you have run a bias analysis first.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">AI-Powered Insights</h1>
        <p className="text-muted">
          Get a Gemini AI explanation of your bias analysis results.
        </p>
      </div>

      {!explanation && !loading && (
        <div className="rounded-xl border border-card-border bg-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 className="text-xl font-semibold mb-2">Generate AI Analysis</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            Click below to send your bias results to Gemini AI for a detailed explanation, reasoning, and recommendations.
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-light"
          >
            Generate Insights
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-card-border bg-card p-12 text-center">
          <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-medium">Analyzing with Gemini AI...</p>
          <p className="text-sm text-muted mt-1">This may take a few seconds</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger mb-6">
          {error}
        </div>
      )}

      {explanation && (
        <div className="space-y-6">
          {/* Explanation */}
          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-semibold">Explanation</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {explanation.explanation}
            </p>
          </div>

          {/* Reasoning */}
          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="font-semibold">Bias Reasoning</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {explanation.reasoning}
            </p>
          </div>

          {/* Suggestions */}
          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-semibold">Suggested Fixes</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {explanation.suggestions}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              className="rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-card"
            >
              Regenerate
            </button>
            <Link
              href="/fixes"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
            >
              View Detailed Fixes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
