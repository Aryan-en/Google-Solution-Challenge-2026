"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BiasChart from "@/app/components/BiasChart";
import type { BiasResults } from "@/lib/api";
import { getReport, downloadPdfReport } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [results, setResults] = useState<BiasResults | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("biasResults");
    if (stored) {
      setResults(JSON.parse(stored));
    }
  }, []);

  const handleDownloadJSON = async () => {
    if (!results?.analysis_id) {
      alert("Missing analysis reference. Please re-run analysis.");
      return;
    }
    try {
      const report = await getReport(results.analysis_id);
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hirelens-bias-report.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate report. Please run analysis first.");
    }
  };

  const handleDownloadPDF = async () => {
    if (!results?.analysis_id) {
      alert("Missing analysis reference. Please re-run analysis.");
      return;
    }
    try {
      const blob = await downloadPdfReport(results.analysis_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hirelens-bias-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate PDF. Please run analysis first.");
    }
  };

  if (!results) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">No Analysis Results</h1>
        <p className="text-muted mb-8">
          Upload a dataset and run bias analysis first.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-light"
        >
          Upload Dataset
        </Link>
      </div>
    );
  }

  const {
    selection_rates,
    group_counts,
    disparate_impact,
    bias_detected,
    groups,
  } = results;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-1">Bias Analysis Dashboard</h1>
          <p className="text-muted">
            Results for <span className="font-medium text-foreground">{results.protected_column}</span> across <span className="font-medium text-foreground">{results.target_column}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadJSON}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-card"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            JSON
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-card"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </button>
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-light"
          >
            View AI Insights
          </Link>
        </div>
      </div>

      {/* Warnings */}
      {results.warnings && results.warnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-warning mb-1">Data Warnings</p>
          <ul className="text-sm text-muted space-y-0.5">
            {results.warnings.map((w, i) => (
              <li key={i}>&bull; {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Bias indicator */}
        <div className={`rounded-xl border p-6 ${bias_detected ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5"}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-3 h-3 rounded-full ${bias_detected ? "bg-danger" : "bg-success"}`} />
            <span className="text-sm font-medium text-muted">Bias Status</span>
          </div>
          <p className={`text-2xl font-bold ${bias_detected ? "text-danger" : "text-success"}`}>
            {bias_detected ? "Bias Detected" : "No Significant Bias"}
          </p>
          <p className="text-sm text-muted mt-1">
            {bias_detected
              ? "Disparate impact below the 4/5ths threshold"
              : "Hiring rates appear equitable across groups"}
          </p>
        </div>

        {/* Disparate Impact */}
        <div className="rounded-xl border border-card-border bg-card p-6">
          <span className="text-sm font-medium text-muted">Disparate Impact</span>
          <p className="text-4xl font-bold mt-2">
            {disparate_impact.toFixed(3)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 rounded-full bg-card-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${disparate_impact >= 0.8 ? "bg-success" : "bg-danger"}`}
                style={{ width: `${Math.min(disparate_impact * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted">/ 0.800</span>
          </div>
          <p className="text-xs text-muted mt-2">
            EEOC threshold: 0.800 (4/5ths rule)
          </p>
        </div>

        {/* Group breakdown */}
        <div className="rounded-xl border border-card-border bg-card p-6">
          <span className="text-sm font-medium text-muted">Group Breakdown</span>
          <div className="mt-3 space-y-3">
            {groups.map((group) => {
              const counts = group_counts[group];
              const rate = selection_rates[group];
              return (
                <div key={group} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{group}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold">
                      {(rate * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted ml-2">
                      ({counts.hired}/{counts.total})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-card-border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Selection Rate by Group</h2>
        <BiasChart selectionRates={selection_rates} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/insights"
          className="rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 transition-colors group"
        >
          <h3 className="font-semibold mb-1 group-hover:text-accent">
            AI Insights
          </h3>
          <p className="text-sm text-muted">
            Get AI-generated explanations of detected bias
          </p>
        </Link>
        <Link
          href="/fixes"
          className="rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 transition-colors group"
        >
          <h3 className="font-semibold mb-1 group-hover:text-accent">
            Fix Suggestions
          </h3>
          <p className="text-sm text-muted">
            Actionable steps to mitigate hiring bias
          </p>
        </Link>
        <Link
          href="/simulator"
          className="rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 transition-colors group"
        >
          <h3 className="font-semibold mb-1 group-hover:text-accent">
            What-If Simulator
          </h3>
          <p className="text-sm text-muted">
            Adjust thresholds and see the impact
          </p>
        </Link>
      </div>
    </div>
  );
}
