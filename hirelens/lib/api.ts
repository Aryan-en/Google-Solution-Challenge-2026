import axios from "axios";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BACKEND_URL,
});

// Attach auth token if present
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Types ───────────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string;
  dtype: string;
  unique_values: number;
  sample_values: (string | number)[];
}

export interface UploadResponse {
  columns: ColumnInfo[];
  row_count: number;
  upload_id: string;
}

export interface BiasResults {
  selection_rates: Record<string, number>;
  group_counts: Record<string, { total: number; hired: number }>;
  disparate_impact: number;
  bias_detected: boolean;
  threshold_used: number;
  groups: string[];
  target_column: string;
  protected_column: string;
  warnings?: string[];
  analysis_id?: number;
}

export interface MultiAttributeResults {
  target_column: string;
  results_by_attribute: Record<string, BiasResults | { error: string }>;
}

export interface Explanation {
  explanation: string;
  reasoning: string;
  suggestions: string;
}

export interface Report {
  report_title: string;
  generated_at: string;
  dataset: string;
  bias_analysis: BiasResults;
  ai_explanation: Explanation | null;
}

export interface AuthResponse {
  token: string;
  user_id: number;
  username: string;
}

export interface HistoryEntry {
  id: number;
  filename: string;
  target_column: string;
  protected_column: string;
  disparate_impact: number;
  bias_detected: boolean;
  created_at: string;
}

export interface HistoryResponse {
  count: number;
  analyses: HistoryEntry[];
}

export interface AnalysisDetail {
  id: number;
  filename: string;
  target_column: string;
  protected_column: string;
  threshold: number;
  bias_results: BiasResults;
  explanation: Explanation | null;
  created_at: string;
}

// ── Auth ────────────────────────────────────────────────────────────────

export async function register(
  username: string,
  password: string
): Promise<AuthResponse> {
  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  const { data } = await api.post<AuthResponse>(
    "/api/auth/register",
    formData
  );
  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);
  return data;
}

export async function login(
  username: string,
  password: string
): Promise<AuthResponse> {
  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  const { data } = await api.post<AuthResponse>("/api/auth/login", formData);
  localStorage.setItem("token", data.token);
  localStorage.setItem("username", data.username);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
}

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("username");
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}

// ── Core API ────────────────────────────────────────────────────────────

export async function uploadCSV(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<UploadResponse>("/api/upload", formData);
  return data;
}

export async function analyzeBias(
  targetColumn: string,
  protectedColumn: string,
  uploadId: string,
  threshold: number = 0.5
): Promise<BiasResults> {
  const formData = new FormData();
  formData.append("target_column", targetColumn);
  formData.append("protected_column", protectedColumn);
  formData.append("upload_id", uploadId);
  formData.append("threshold", threshold.toString());
  const { data } = await api.post<BiasResults>("/api/analyze", formData);
  return data;
}

export async function analyzeBiasMulti(
  targetColumn: string,
  protectedColumns: string[],
  uploadId: string,
  threshold: number = 0.5
): Promise<MultiAttributeResults> {
  const formData = new FormData();
  formData.append("target_column", targetColumn);
  formData.append("protected_columns", protectedColumns.join(","));
  formData.append("upload_id", uploadId);
  formData.append("threshold", threshold.toString());
  const { data } = await api.post<MultiAttributeResults>(
    "/api/analyze/multi",
    formData
  );
  return data;
}

export async function getExplanation(analysisId?: number): Promise<Explanation> {
  const formData = new FormData();
  if (analysisId !== undefined) {
    formData.append("analysis_id", analysisId.toString());
  }
  const { data } = await api.post<Explanation>("/api/explain", formData);
  return data;
}

export async function simulateThreshold(
  threshold: number,
  analysisId?: number
): Promise<BiasResults> {
  const formData = new FormData();
  formData.append("threshold", threshold.toString());
  if (analysisId !== undefined) {
    formData.append("analysis_id", analysisId.toString());
  }
  const { data } = await api.post<BiasResults>("/api/simulate", formData);
  return data;
}

export async function getReport(analysisId?: number): Promise<Report> {
  const { data } = await api.get<Report>("/api/report", {
    params: analysisId !== undefined ? { analysis_id: analysisId } : undefined,
  });
  return data;
}

export async function downloadPdfReport(analysisId?: number): Promise<Blob> {
  const { data } = await api.get("/api/report/pdf", {
    responseType: "blob",
    params: analysisId !== undefined ? { analysis_id: analysisId } : undefined,
  });
  return data;
}

// ── History ─────────────────────────────────────────────────────────────

export async function getHistory(limit = 20): Promise<HistoryResponse> {
  const { data } = await api.get<HistoryResponse>("/api/history", {
    params: { limit },
  });
  return data;
}

export async function getAnalysisDetail(
  id: number
): Promise<AnalysisDetail> {
  const { data } = await api.get<AnalysisDetail>(`/api/history/${id}`);
  return data;
}
