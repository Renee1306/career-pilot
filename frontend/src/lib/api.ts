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

export interface JobAnalysisOut {
  id: string;
  job_description_id: string;
  explanation: JobExplanation | null;
  typical_day: TypicalDay | null;
  translations: Record<string, JobExplanation>;
  typical_day_translations: Record<string, TypicalDay>;
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

export function generateFullAnalysis(jobId: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/analyze-all`);
}

export function translateExplanation(jobId: string, language: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/explanation/translate`, { language });
}

export function translateTypicalDay(jobId: string, language: string): Promise<JobAnalysisOut> {
  return postJson(`/jobs/${jobId}/typical-day/translate`, { language });
}

export type PhotoShape = "circle" | "square" | "rounded";

export interface PhotoStyle {
  size: number;
  shape: PhotoShape;
  border: boolean;
}

export interface BasicInfo {
  full_name: string;
  age: string | null;
  gender: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  photo: PhotoStyle;
}

export interface WorkExperienceEntry {
  id: string;
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  major: string;
  degree: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface CertificateEntry {
  id: string;
  name: string;
  date: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  period: string;
  website: string | null;
  description: string;
}

export interface AwardEntry {
  id: string;
  title: string;
  awarder: string;
  date: string;
  website: string | null;
  description: string;
}

export type Fluency = "basic" | "conversational" | "fluent" | "native";

export interface LanguageEntry {
  id: string;
  language: string;
  fluency: Fluency;
}

export interface VolunteerEntry {
  id: string;
  organization: string;
  role: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  relationship: string;
  contact: string;
  description: string;
}

export interface CustomSection {
  id: string;
  title: string;
  content: string;
}

export type SectionKey =
  | "summary"
  | "work_experience"
  | "education"
  | "projects"
  | "skills"
  | "certificates"
  | "awards"
  | "languages"
  | "volunteer"
  | "references";

export const FIXED_SECTION_KEYS: SectionKey[] = [
  "summary",
  "work_experience",
  "education",
  "projects",
  "skills",
  "certificates",
  "awards",
  "languages",
  "volunteer",
  "references",
];

export interface ResumeContent {
  basic_info: BasicInfo;
  summary: { text: string };
  work_experience: WorkExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: { items: string[] };
  certificates: CertificateEntry[];
  awards: AwardEntry[];
  languages: LanguageEntry[];
  volunteer: VolunteerEntry[];
  references: ReferenceEntry[];
  custom_sections: CustomSection[];
  section_order: string[];
  enabled_sections: Record<string, boolean>;
}

/** Section order including any fixed keys missing from a resume saved before this
 * section type existed (backward compat) - appended at the end, defaulting to enabled. */
export function getEffectiveSectionOrder(content: ResumeContent): string[] {
  const missing = FIXED_SECTION_KEYS.filter((k) => !content.section_order.includes(k));
  return [...content.section_order, ...missing];
}

export interface ResumeStyle {
  accent_color: string;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  font_family: string;
  name_font_size: number;
  heading_font_size: number;
  body_font_size: number;
  line_height: number;
}

export interface ResumeDocumentListItem {
  id: string;
  name: string;
  template_id: string;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeDocumentOut extends ResumeDocumentListItem {
  user_id: string;
  content: ResumeContent;
  style: ResumeStyle;
}

export function listResumeDocuments(): Promise<ResumeDocumentListItem[]> {
  return authedFetch("/resume-documents");
}

export function createResumeDocument(payload: {
  name?: string;
  template_id?: string;
}): Promise<ResumeDocumentOut> {
  return authedFetch("/resume-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function importResumeDocument(file: File): Promise<ResumeDocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  return authedFetch("/resume-documents/import", { method: "POST", body: formData });
}

export function getResumeDocument(id: string): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}`);
}

export function updateResumeDocument(
  id: string,
  payload: Partial<{ name: string; template_id: string; content: ResumeContent; style: ResumeStyle }>
): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteResumeDocument(id: string): Promise<{ deleted: boolean }> {
  return authedFetch(`/resume-documents/${id}`, { method: "DELETE" });
}

export function duplicateResumeDocument(id: string): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}/duplicate`, { method: "POST" });
}

export function uploadResumePhoto(id: string, file: File): Promise<ResumeDocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  return authedFetch(`/resume-documents/${id}/photo`, { method: "POST", body: formData });
}

export function deleteResumePhoto(id: string): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}/photo`, { method: "DELETE" });
}

export function enhanceResumeText(payload: { text: string; context?: string }): Promise<{ text: string }> {
  return authedFetch("/resume-documents/enhance-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export interface JDMatchEvaluation {
  match_score: number;
  strengths: string[];
  gaps: string[];
}

export function evaluateResumeForJD(id: string, jdText: string): Promise<JDMatchEvaluation> {
  return authedFetch(`/resume-documents/${id}/jd-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  });
}

export function customizeResumeForJD(id: string, jdText: string): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}/jd-customize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  });
}

export interface ResumeSuggestion {
  target: "summary" | "work_experience" | "skills";
  entry_id: string | null;
  entry_label: string;
  original_text: string;
  suggested_text: string;
  reason: string;
}

export function suggestResumeEditsForJD(
  id: string,
  jdText: string
): Promise<{ suggestions: ResumeSuggestion[] }> {
  return authedFetch(`/resume-documents/${id}/jd-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  });
}

/** Apply one accepted suggestion to a resume document's content, addressed by entry id (never by
 *  list position - the user can reorder or delete entries while the review modal is open). */
export function applyResumeSuggestion(
  content: ResumeContent,
  suggestion: ResumeSuggestion
): ResumeContent {
  if (suggestion.target === "summary") {
    return { ...content, summary: { ...content.summary, text: suggestion.suggested_text } };
  }
  if (suggestion.target === "skills") {
    const items = suggestion.suggested_text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { ...content, skills: { ...content.skills, items } };
  }
  return {
    ...content,
    work_experience: content.work_experience.map((entry) =>
      entry.id === suggestion.entry_id ? { ...entry, description: suggestion.suggested_text } : entry
    ),
  };
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export function sendChatMessage(payload: {
  message: string;
  history: ChatMessage[];
  job_id?: string;
  resume_id?: string;
}): Promise<{ reply: string }> {
  return authedFetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type ApplicationStatus = "applied" | "pending_interview" | "offer" | "rejected";
export type TimelineEntryType = "applied" | "rejected" | "interview" | "case_study" | "note";

export interface TimelineEntryAttachment {
  filename: string;
  storage_path: string;
  url?: string;
}

export interface TimelineEntryDetails {
  meeting_link?: string;
  deadline?: string;
  attachments?: TimelineEntryAttachment[];
}

export interface TimelineEntryOut {
  id: string;
  entry_type: TimelineEntryType;
  occurred_at: string;
  content: string;
  details: TimelineEntryDetails;
  source: "manual" | "gmail";
  created_at: string;
  updated_at: string;
}

export interface CompanySnapshot {
  culture: string;
  core_values: string[];
  engineering_focus: string;
  interview_themes: string[];
}

export type InterviewRoundType = "hr" | "technical";

export interface QnAItem {
  question: string;
  suggested_answer: string;
}

export interface InterviewQnA {
  questions: QnAItem[];
}

export interface ApplicationOut {
  id: string;
  job_description_id: string | null;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_date: string | null;
  company: string | null;
  position: string | null;
  company_snapshot: CompanySnapshot | null;
  interview_questions: Record<InterviewRoundType, InterviewQnA | undefined> | null;
  timeline: TimelineEntryOut[];
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
  company?: string;
  position?: string;
}): Promise<ApplicationOut> {
  return authedFetch("/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateApplication(
  applicationId: string,
  payload: { status?: ApplicationStatus; applied_date?: string; company?: string; position?: string }
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteApplication(applicationId: string): Promise<{ deleted: boolean }> {
  return authedFetch(`/applications/${applicationId}`, { method: "DELETE" });
}

export function generateCompanySnapshot(applicationId: string): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/company-snapshot`, { method: "POST" });
}

export function generateInterviewQuestions(
  applicationId: string,
  roundType: InterviewRoundType,
  jdText?: string
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/interview-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_type: roundType, jd_text: jdText || undefined }),
  });
}

export function createTimelineEntry(
  applicationId: string,
  payload: { entry_type: TimelineEntryType; occurred_at?: string; content?: string; details?: TimelineEntryDetails }
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateTimelineEntry(
  applicationId: string,
  entryId: string,
  payload: { occurred_at?: string; content?: string; details?: TimelineEntryDetails }
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/timeline/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteTimelineEntry(applicationId: string, entryId: string): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/timeline/${entryId}`, { method: "DELETE" });
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
  entry_type: TimelineEntryType | "other" | null;
  summary: string;
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
