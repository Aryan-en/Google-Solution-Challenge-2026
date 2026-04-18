"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BiasChart from "@/app/components/BiasChart";
import { simulateThreshold } from "@/lib/api";
import type { BiasResults } from "@/lib/api";

export default function SimulatorPage() {
  const [threshold, setThreshold] = useState(0.5);
  const [results, setResults] = useState<BiasResults | null>(null);
  const [originalResults, setOriginalResults] = useState<BiasResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("biasResults");
    if (stored) {
      const parsed = JSON.parse(stored);
      setOriginalResults(parsed);
      setResults(parsed);
      setThreshold(parsed.threshold_used);
    }
  }, []);

  const handleSimulate = async () => {
    const analysisId = originalResults?.analysis_id;
    if (!analysisId) {
      setError("Missing analysis reference. Please run analysis again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await simulateThreshold(threshold, analysisId);
      setResults(result);
    } catch {
      setError("Simulation failed. Make sure you have uploaded data and run analysis.");
    } finally {
      setLoading(false);
    }
  };

  if (!originalResults) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">What-If Simulator</h1>
        <p className="text-muted mb-8">
          Upload a dataset and run bias analysis first to use the simulator.
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">What-If Simulator</h1>
        <p className="text-muted">
          Adjust the hiring threshold and see how it affects bias metrics in real time.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger mb-6">
          {error}
        </div>
      )}

      {/* Threshold control */}
      <div className="rounded-xl border border-card-border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Hiring Threshold</h2>
        <p className="text-sm text-muted mb-6">
          Candidates with a score above this threshold are considered &quot;hired&quot;.
          Adjust it to see how different cutoffs affect fairness.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-2xl font-bold font-mono w-20 text-right">
              {threshold.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>0.00 (hire all)</span>
            <span>0.50</span>
            <span>1.00 (hire none)</span>
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            {loading ? "Simulating..." : "Simulate"}
          </button>
        </div>
      </div>

      {results && (
        <>
          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-xl border border-card-border bg-card p-6">
              <span className="text-sm font-medium text-muted">
                Disparate Impact
              </span>
              <p className="text-4xl font-bold mt-2">
                {results.disparate_impact.toFixed(3)}
              </p>
              <div className={`inline-flex items-center gap-1.5 mt-2 text-sm ${results.bias_detected ? "text-danger" : "text-success"}`}>
                <div className={`w-2 h-2 rounded-full ${results.bias_detected ? "bg-danger" : "bg-success"}`} />
                {results.bias_detected ? "Below threshold" : "Above threshold"}
              </div>
            </div>

            {originalResults && (
              <div className="rounded-xl border border-card-border bg-card p-6">
                <span className="text-sm font-medium text-muted">
                  Change from Original
                </span>
                <p className="text-4xl font-bold mt-2">
                  {((results.disparate_impact - originalResults.disparate_impact) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-muted mt-2">
                  Original DI: {originalResults.disparate_impact.toFixed(3)} at threshold {originalResults.threshold_used}
                </p>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-card-border bg-card p-6 mb-8">
            <h2 className="font-semibold mb-4">
              Selection Rates at Threshold {results.threshold_used}
            </h2>
            <BiasChart selectionRates={results.selection_rates} />
          </div>

          {/* Group details */}
          <div className="rounded-xl border border-card-border bg-card p-6">
            <h2 className="font-semibold mb-4">Detailed Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left">
                    <th className="pb-3 font-medium text-muted">Group</th>
                    <th className="pb-3 font-medium text-muted">Total</th>
                    <th className="pb-3 font-medium text-muted">Hired</th>
                    <th className="pb-3 font-medium text-muted">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {results.groups.map((group) => (
                    <tr key={group} className="border-b border-card-border/50">
                      <td className="py-3 capitalize font-medium">{group}</td>
                      <td className="py-3">{results.group_counts[group].total}</td>
                      <td className="py-3">{results.group_counts[group].hired}</td>
                      <td className="py-3 font-semibold">
                        {(results.selection_rates[group] * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
