import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function authedFetch(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not signed in");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }
  return response.json();
}

export interface ResumeOut {
  id: string;
  label: string | null;
  file_url: string | null;
  parsed_text: string | null;
  parsed_json: Record<string, unknown> | null;
  version: number;
  created_at: string;
}

export interface JobDescriptionOut {
  id: string;
  company: string | null;
  title: string | null;
  raw_text: string;
  source_url: string | null;
  created_at: string;
}

export function listResumes(): Promise<ResumeOut[]> {
  return authedFetch("/resumes");
}

export function uploadResume(file: File, label?: string): Promise<ResumeOut> {
  const formData = new FormData();
  formData.append("file", file);
  if (label) formData.append("label", label);
  return authedFetch("/resumes/upload", { method: "POST", body: formData });
}

export function listJobDescriptions(): Promise<JobDescriptionOut[]> {
  return authedFetch("/jobs");
}

export function createJobDescription(payload: {
  raw_text: string;
  company?: string;
  title?: string;
  source_url?: string;
}): Promise<JobDescriptionOut> {
  return authedFetch("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
