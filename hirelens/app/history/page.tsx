"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHistory, getAnalysisDetail } from "@/lib/api";
import type { HistoryEntry } from "@/lib/api";

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getHistory(50);
        setEntries(res.analyses);
      } catch {
        setError("Failed to load history. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLoad = async (id: number) => {
    try {
      const detail = await getAnalysisDetail(id);
      sessionStorage.setItem("biasResults", JSON.stringify(detail.bias_results));
      if (detail.explanation) {
        sessionStorage.setItem("explanation", JSON.stringify(detail.explanation));
      }
      window.location.href = "/dashboard";
    } catch {
      alert("Failed to load analysis.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Analysis History</h1>
        <p className="text-muted">
          Browse and reload past bias analyses.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading history...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="text-center py-12 rounded-xl border border-card-border bg-card">
          <p className="text-muted mb-4">No analyses yet.</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
          >
            Upload Your First Dataset
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => handleLoad(entry.id)}
              className="w-full text-left rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{entry.filename}</span>
                <span className="text-xs text-muted">
                  {new Date(entry.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted">
                  {entry.protected_column} &rarr; {entry.target_column}
                </span>
                <span className="font-mono">DI: {entry.disparate_impact.toFixed(3)}</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    entry.bias_detected
                      ? "bg-danger/10 text-danger"
                      : "bg-success/10 text-success"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      entry.bias_detected ? "bg-danger" : "bg-success"
                    }`}
                  />
                  {entry.bias_detected ? "Bias" : "Fair"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
