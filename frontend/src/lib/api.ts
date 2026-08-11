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

export function getResume(resumeId: string): Promise<ResumeOut> {
  return authedFetch(`/resumes/${resumeId}`);
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

export function getJobDescription(jobId: string): Promise<JobDescriptionOut> {
  return authedFetch(`/jobs/${jobId}`);
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

export interface ResponsibilityItem {
  responsibility: string;
  simple_explanation: string;
  example: string;
}

export interface RequirementItem {
  requirement: string;
  why_it_matters: string;
  evidence: string;
  explanation: string;
}

export interface RequirementBreakdown {
  hard_requirements: RequirementItem[];
  learnable: RequirementItem[];
  bonus: RequirementItem[];
}

export interface KeyTerm {
  term: string;
  simple_explanation: string;
  example: string;
}

export interface InterviewQuestions {
  hr_questions: string[];
  role_questions: string[];
}

export interface JobExplanation {
  one_sentence_summary: string;
  top_responsibilities: ResponsibilityItem[];
  requirements: RequirementBreakdown;
  key_terms: KeyTerm[];
  likely_questions: InterviewQuestions;
}

export interface DayPeriod {
  approximate_time: string;
  activity: string;
  description: string;
  rationale: string;
}

export interface DayBreakdown {
  morning: DayPeriod;
  afternoon: DayPeriod;
  end_of_day: DayPeriod;
}

export interface TimeAllocation {
  technical_development: number;
  meetings_communication: number;
  analysis_problem_solving: number;
  testing_qa: number;
  documentation_administrative: number;
  research_learning: number;
  other: number;
}

export interface Collaborator {
  who: string;
  why: string;
  example_interaction: string;
}

export interface TypicalDay {
  overview: string;
  day_breakdown: DayBreakdown;
  time_allocation: TimeAllocation;
  collaborators: Collaborator[];
  surprises: string[];
}

export interface ResumeEdit {
  original_text: string;
  suggested_text: string;
  reason: string;
}

export interface ResumeMatch {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  edits: ResumeEdit[];
  summary: string;
}

export interface JobAnalysisOut {
  id: string;
  job_description_id: string;
  resume_id: string | null;
  explanation: JobExplanation | null;
  typical_day: TypicalDay | null;
  match_suggestions: ResumeMatch | null;
  translations: Record<string, JobExplanation>;
  created_at: string;
}

function postJson(path: string, body?: unknown): Promise<JobAnalysisOut> {
  return authedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function getAnalysis(jobId: string): Promise<JobAnalysisOut | null> {
  return authedFetch(`/jobs/${jobId}/analysis`);
}

export function generateExplanation(jobId: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/explanation`);
}

export function generateTypicalDay(jobId: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/typical-day`);
}

export function generateResumeMatch(jobId: string, resumeId: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/resume-match`, { resume_id: resumeId });
}

export function generateFullAnalysis(jobId: string, resumeId: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/analyze-all`, { resume_id: resumeId });
}

export function translateExplanation(jobId: string, language: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/explanation/translate`, { language });
}

export async function exportResumePdf(text: string, filename?: string): Promise<Blob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const response = await fetch(`${API_BASE_URL}/resumes/export-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, filename }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Export failed (${response.status}): ${body}`);
  }
  return response.blob();
}

export type ApplicationStatus = "applied" | "pending_interview" | "offer" | "rejected";

export interface TimelineEntry {
  date: string;
  note: string;
}

export interface ApplicationOut {
  id: string;
  job_description_id: string | null;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_date: string | null;
  timeline: TimelineEntry[];
  created_at: string;
  updated_at: string;
}

export function listApplications(): Promise<ApplicationOut[]> {
  return authedFetch("/applications");
}

export function getApplication(applicationId: string): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}`);
}

export function createApplication(payload: {
  job_description_id?: string;
  resume_id?: string;
  status?: ApplicationStatus;
  applied_date?: string;
}): Promise<ApplicationOut> {
  return authedFetch("/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateApplication(
  applicationId: string,
  payload: { status?: ApplicationStatus; applied_date?: string }
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function addTimelineEntry(applicationId: string, note: string): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export type RoundType = "hr" | "hiring_manager" | "technical" | "other";

export interface QnAItem {
  question: string;
  suggested_answer: string;
}

export interface InterviewQnA {
  questions: QnAItem[];
}

export interface InterviewRoundOut {
  id: string;
  application_id: string;
  round_type: RoundType;
  scheduled_at: string | null;
  link: string | null;
  notes: string | null;
  generated_qna: InterviewQnA | null;
  created_at: string;
}

export function listInterviewRounds(applicationId: string): Promise<InterviewRoundOut[]> {
  return authedFetch(`/interview-rounds?application_id=${applicationId}`);
}

export function createInterviewRound(payload: {
  application_id: string;
  round_type: RoundType;
  scheduled_at?: string;
  link?: string;
  notes?: string;
}): Promise<InterviewRoundOut> {
  return authedFetch("/interview-rounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateInterviewRound(
  roundId: string,
  payload: { round_type?: RoundType; scheduled_at?: string; link?: string; notes?: string }
): Promise<InterviewRoundOut> {
  return authedFetch(`/interview-rounds/${roundId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function generateInterviewQnA(roundId: string): Promise<InterviewRoundOut> {
  return authedFetch(`/interview-rounds/${roundId}/generate-qna`, { method: "POST" });
}

export interface GmailSyncStatus {
  connected: boolean;
  google_email: string | null;
  last_synced_at: string | null;
}

export interface DetectedUpdate {
  gmail_message_id: string;
  subject: string;
  snippet: string;
  received_at: string | null;
  company: string | null;
  role: string | null;
  detected_status: ApplicationStatus | null;
  reasoning: string;
  suggested_action: "create_application" | "update_status" | "ignore";
  matching_application_id: string | null;
}

export interface GmailSyncResult {
  scanned: number;
  detected: DetectedUpdate[];
}

export function getGmailStatus(): Promise<GmailSyncStatus> {
  return authedFetch("/gmail/status");
}

export async function getGmailConnectUrl(): Promise<string> {
  const result = await authedFetch("/gmail/connect");
  return result.auth_url;
}

export function syncGmail(): Promise<GmailSyncResult> {
  return authedFetch("/gmail/sync", { method: "POST" });
}
