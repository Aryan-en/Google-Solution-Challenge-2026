"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadCSV, analyzeBias } from "@/lib/api";
import type { ColumnInfo } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [uploadId, setUploadId] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [protectedCol, setProtectedCol] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "configure">("upload");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".csv")) {
      setFile(droppedFile);
      setError("");
    } else {
      setError("Please upload a CSV file.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadCSV(file);
      setColumns(result.columns);
      setRowCount(result.row_count);
      setUploadId(result.upload_id);
      setStep("configure");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!targetCol || !protectedCol) {
      setError("Please select both columns.");
      return;
    }
    if (targetCol === protectedCol) {
      setError("Target and protected columns must be different.");
      return;
    }
    if (!uploadId) {
      setError("Upload session expired. Please upload the file again.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const results = await analyzeBias(targetCol, protectedCol, uploadId);
      // Store results in sessionStorage for dashboard
      sessionStorage.setItem("biasResults", JSON.stringify(results));
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Upload Dataset</h1>
        <p className="text-muted">
          Upload a CSV file containing your hiring data to begin bias analysis.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-xl border-2 border-dashed border-card-border hover:border-accent/50 transition-colors p-12 text-center cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop your CSV file here</p>
                <p className="text-sm text-muted mt-1">
                  or click to browse files
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload & Continue"}
          </button>
        </div>
      )}

      {step === "configure" && (
        <div className="space-y-6">
          {/* Dataset info */}
          <div className="rounded-xl border border-card-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Dataset Loaded</h2>
              <span className="text-sm text-muted">{rowCount} rows</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <span
                  key={col.name}
                  className="inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                >
                  {col.name}
                </span>
              ))}
            </div>
          </div>

          {/* Column selection */}
          <div className="rounded-xl border border-card-border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Configure Analysis</h2>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Target Column
                <span className="text-muted font-normal ml-1">
                  (the hiring decision, e.g. &quot;hired&quot;)
                </span>
              </label>
              <select
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">Select column...</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dtype}, {col.unique_values} unique)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Protected Attribute
                <span className="text-muted font-normal ml-1">
                  (e.g. &quot;gender&quot;, &quot;race&quot;)
                </span>
              </label>
              <select
                value={protectedCol}
                onChange={(e) => setProtectedCol(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">Select column...</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.unique_values} groups:{" "}
                    {col.sample_values.join(", ")})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep("upload");
                setFile(null);
                setColumns([]);
                setUploadId("");
              }}
              className="rounded-lg border border-card-border px-4 py-3 text-sm font-medium hover:bg-card"
            >
              Back
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? "Analyzing..." : "Run Bias Analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
