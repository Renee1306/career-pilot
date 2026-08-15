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

/** Shared in-memory cache for the small "list everything so a picker can show it" endpoints -
 *  job descriptions and resume documents are each fetched by several unrelated dropdowns (Job
 *  Analysis, the JD coach, Interview Questions, ...), and every one of them re-hitting the
 *  network on mount was the actual source of "this dropdown takes a while to load". The list
 *  barely changes between mounts, so serving the cached copy - refreshed whenever something
 *  explicitly needs current data, via `force` - is a better trade than re-fetching every time a
 *  picker appears. Module-level (not React state) so it's shared by every component regardless
 *  of mount/unmount, and survives navigating between pages. */
function createListCache<T>(fetcher: () => Promise<T[]>) {
  let cached: T[] | null = null;
  let inFlight: Promise<T[]> | null = null;

  const load = (opts?: { force?: boolean }): Promise<T[]> => {
    if (!opts?.force) {
      if (cached) return Promise.resolve(cached);
      if (inFlight) return inFlight;
    }
    inFlight = fetcher()
      .then((data) => {
        cached = data;
        inFlight = null;
        return data;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });
    return inFlight;
  };

  // Lets a create-endpoint hand its freshly-created row straight to the cache instead of every
  // caller having to know to force a whole refetch just to make a picker see its own new entry.
  const prepend = (item: T) => {
    if (cached) cached = [item, ...cached];
  };

  // For deletes: a stale cached entry is usually harmless (a dropdown label a beat out of date),
  // but an entry a picker can still select that 404s the moment something tries to use it is an
  // actual bug, not just staleness - worth the extra call site to avoid.
  const remove = (predicate: (item: T) => boolean) => {
    if (cached) cached = cached.filter((item) => !predicate(item));
  };

  return { load, prepend, remove };
}

export interface JobDescriptionOut {
  id: string;
  company: string | null;
  title: string | null;
  raw_text: string;
  source_url: string | null;
  created_at: string;
}

const jobDescriptionsCache = createListCache<JobDescriptionOut>(() => authedFetch("/jobs"));

export function listJobDescriptions(opts?: { force?: boolean }): Promise<JobDescriptionOut[]> {
  return jobDescriptionsCache.load(opts);
}

export function getJobDescription(jobId: string): Promise<JobDescriptionOut> {
  return authedFetch(`/jobs/${jobId}`);
}

export async function createJobDescription(payload: {
  raw_text: string;
  company?: string;
  title?: string;
  source_url?: string;
}): Promise<JobDescriptionOut> {
  const job = await authedFetch("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  jobDescriptionsCache.prepend(job);
  return job;
}

/** Warms the job description / resume document caches right after sign-in, so the first dropdown
 *  the user opens (wherever they land) doesn't pay for the fetch - see createListCache above.
 *  Fire-and-forget: a picker that mounts before this resolves just falls back to its own normal
 *  (cached-if-ready, fetched-if-not) load, so a slow or failed prefetch never blocks anything. */
export function prefetchPickerData() {
  listJobDescriptions().catch(() => {});
  listResumeDocuments().catch(() => {});
}

/** Job Analysis only ever saves `raw_text` - `title`/`company` are almost always null in
 *  practice, so a dropdown built on those alone reads as a wall of "Untitled role". Fall back to
 *  a snippet of the pasted text plus the save date, which is always distinguishing. Shared by
 *  every picker that lets a user choose a previously-saved job description. */
export function jobOptionLabel(job: JobDescriptionOut): string {
  const date = new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (job.title) {
    return job.company ? `${job.company} — ${job.title}` : job.title;
  }
  const snippet = job.raw_text.trim().replace(/\s+/g, " ").slice(0, 60);
  return `${date} — ${snippet}${job.raw_text.length > 60 ? "..." : ""}`;
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

export interface JobExplanation {
  one_sentence_summary: string;
  top_responsibilities: ResponsibilityItem[];
  requirements: RequirementBreakdown;
  key_terms: KeyTerm[];
  role_questions: string[];
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
  explanation_translations: Record<string, JobExplanation>;
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

/** One category of skills, rendered as a single bullet ("Data Tools: R, MySQL, SAS").
 *  An empty `category` renders as a bare list of skills with no label. */
export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
}

export interface SkillsSection {
  groups: SkillGroup[];
}

/** The one-line form of a skill group - what the template renders and, therefore, what a JD hint
 *  matches against and replaces. Kept next to `parseSkillLine` so the round trip stays obvious. */
export function formatSkillLine(group: SkillGroup): string {
  const items = group.items.filter((s) => s.trim()).join(", ");
  return group.category.trim() ? `${group.category.trim()}: ${items}` : items;
}

/** Inverse of `formatSkillLine`, used when an accepted hint hands back an edited line. */
export function parseSkillLine(line: string): { category: string; items: string[] } {
  const [head, ...rest] = line.split(":");
  const hasCategory = rest.length > 0 && head.trim().length > 0 && head.trim().length <= 40;
  const category = hasCategory ? head.trim() : "";
  const tail = hasCategory ? rest.join(":") : line;
  return { category, items: tail.split(",").map((s) => s.trim()).filter(Boolean) };
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
  skills: SkillsSection;
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
  name_color: string;
  heading_color: string;
  body_color: string;
  text_align: "left" | "center" | "right" | "justify";
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

const resumeDocumentsCache = createListCache<ResumeDocumentListItem>(() => authedFetch("/resume-documents"));

export function listResumeDocuments(opts?: { force?: boolean }): Promise<ResumeDocumentListItem[]> {
  return resumeDocumentsCache.load(opts);
}

export async function createResumeDocument(payload: {
  name?: string;
  template_id?: string;
}): Promise<ResumeDocumentOut> {
  const doc = await authedFetch("/resume-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  resumeDocumentsCache.prepend(doc);
  return doc;
}

export async function importResumeDocument(file: File): Promise<ResumeDocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  const doc = await authedFetch("/resume-documents/import", { method: "POST", body: formData });
  resumeDocumentsCache.prepend(doc);
  return doc;
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

export async function deleteResumeDocument(id: string): Promise<{ deleted: boolean }> {
  const result = await authedFetch(`/resume-documents/${id}`, { method: "DELETE" });
  resumeDocumentsCache.remove((doc) => doc.id === id);
  return result;
}

export async function duplicateResumeDocument(id: string): Promise<ResumeDocumentOut> {
  const doc = await authedFetch(`/resume-documents/${id}/duplicate`, { method: "POST" });
  resumeDocumentsCache.prepend(doc);
  return doc;
}

export function uploadResumePhoto(id: string, file: File): Promise<ResumeDocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  return authedFetch(`/resume-documents/${id}/photo`, { method: "POST", body: formData });
}

export function deleteResumePhoto(id: string): Promise<ResumeDocumentOut> {
  return authedFetch(`/resume-documents/${id}/photo`, { method: "DELETE" });
}

export function generateResumeSummary(id: string): Promise<{ text: string }> {
  return authedFetch(`/resume-documents/${id}/generate-summary`, { method: "POST" });
}

export type HintTarget = "summary" | "work_experience" | "projects" | "skills";

/** One reviewable edit, rendered as an inline hint on the resume preview.
 *
 *  `mode` is the important distinction: "replace" rewords a line that already exists, while
 *  "append" adds a new one - which only ever comes out of the gap conversation, after the
 *  candidate has confirmed they genuinely have that experience.
 *
 *  A "replace" hint can also restructure a bullet: `suggested_text` may hold two newline-joined
 *  lines to split one bullet into two, and `merge_bullet_index` may name a second original
 *  bullet - in the same entry - that this hint folds into `bullet_index`, with `original_text`
 *  then holding both source lines newline-joined in (bullet_index, merge_bullet_index) order. */
export interface ResumeHint {
  id: string;
  target: HintTarget;
  entry_id: string | null;
  entry_label: string;
  bullet_index: number | null;
  merge_bullet_index: number | null;
  mode: "replace" | "append";
  original_text: string;
  suggested_text: string;
  reason: string;
  source: "reframe" | "gap";
}

export interface JDGap {
  id: string;
  title: string;
  detail: string;
}

export interface JDReview {
  match_score: number;
  strengths: string[];
  gaps: JDGap[];
  hints: ResumeHint[];
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GapTurnResponse {
  status: "asking" | "ready" | "declined";
  message: string;
  hints: ResumeHint[];
}

export function reviewResumeForJD(id: string, jdText: string): Promise<JDReview> {
  return authedFetch(`/resume-documents/${id}/jd-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd_text: jdText }),
  });
}

export function runGapTurn(
  id: string,
  payload: { jd_text: string; gap: JDGap; strengths: string[]; history: CoachMessage[] }
): Promise<GapTurnResponse> {
  return authedFetch(`/resume-documents/${id}/jd-gap-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Strips a leading bullet marker a source resume (or a pasted description) may already carry -
 *  the template supplies its own via list-style, so leaving the original in would double it up. */
export const BULLET_PREFIX = /^[•●▪◦‣∙*-]\s+/;

/** Split a description into the lines the template renders as bullets. Must stay in step with
 *  `DescriptionText` in components/resume-builder/templates/blocks.tsx and with `_split_bullets`
 *  in backend/app/agents/jd_coach.py - all three have to agree on what one bullet is, or an
 *  accepted hint rewrites the wrong line. */
export function splitBullets(description: string): string[] {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim().replace(BULLET_PREFIX, ""))
    .filter(Boolean);
}

/** Which line a hint targets, or -1 if it no longer applies.
 *
 *  Position and text must still agree - the same rule the preview uses to decide whether to
 *  highlight the line at all (see `HintLayer.replaceHint`), so what gets written is always
 *  exactly the line the user clicked. If the user edited that line while the hint was pending,
 *  the hint is void rather than being applied to whatever now sits there. A hint carrying no
 *  index (the whole-field case, e.g. the summary) falls back to matching on text alone. */
function locateLine(lines: string[], hint: ResumeHint): number {
  if (hint.bullet_index === null) return lines.findIndex((line) => line === hint.original_text);
  return lines[hint.bullet_index] === hint.original_text ? hint.bullet_index : -1;
}

function applyToDescription(description: string, hint: ResumeHint): string {
  const lines = splitBullets(description);
  if (hint.mode === "append") return [...lines, hint.suggested_text].join("\n");

  if (hint.merge_bullet_index !== null) {
    const [firstText, secondText] = hint.original_text.split("\n");
    if (
      hint.bullet_index === null ||
      lines[hint.bullet_index] !== firstText ||
      lines[hint.merge_bullet_index] !== secondText
    ) {
      return description;
    }
    const keepIndex = hint.bullet_index;
    const dropIndex = hint.merge_bullet_index;
    const merged: string[] = [];
    lines.forEach((line, i) => {
      if (i === dropIndex) return;
      merged.push(i === keepIndex ? hint.suggested_text : line);
    });
    return merged.join("\n");
  }

  const index = locateLine(lines, hint);
  if (index === -1) return description;
  return lines.map((line, i) => (i === index ? hint.suggested_text : line)).join("\n");
}

/** Apply one accepted hint, addressed by entry id (never by list position - the user can reorder
 *  or delete entries while hints are still pending on the preview). */
export function applyResumeHint(content: ResumeContent, hint: ResumeHint): ResumeContent {
  if (hint.target === "summary") {
    const text =
      hint.mode === "append"
        ? [content.summary.text.trim(), hint.suggested_text].filter(Boolean).join("\n")
        : hint.suggested_text;
    return { ...content, summary: { ...content.summary, text } };
  }

  if (hint.target === "skills") {
    const groups = [...content.skills.groups];
    // A skills hint addresses one whole group, because one group is what renders as one bullet.
    // An append is a new skill, which joins the uncategorised group (created if there isn't one).
    if (hint.mode === "append") {
      const loose = groups.findIndex((g) => !g.category.trim());
      if (loose === -1) {
        return {
          ...content,
          skills: {
            groups: [...groups, { id: crypto.randomUUID(), category: "", items: [hint.suggested_text] }],
          },
        };
      }
      groups[loose] = { ...groups[loose], items: [...groups[loose].items, hint.suggested_text] };
      return { ...content, skills: { groups } };
    }

    const index = locateLine(groups.map(formatSkillLine), hint);
    if (index === -1) return content;
    const parsed = parseSkillLine(hint.suggested_text);
    groups[index] = { ...groups[index], category: parsed.category, items: parsed.items };
    return { ...content, skills: { groups } };
  }

  const key = hint.target === "projects" ? "projects" : "work_experience";
  return {
    ...content,
    [key]: content[key].map((entry) =>
      entry.id === hint.entry_id ? { ...entry, description: applyToDescription(entry.description, hint) } : entry
    ),
  };
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

export type InterviewRoundType = "behavioural" | "hiring_manager";

/** Deliberately carries no written answer - the candidate gets the question plus the shape of a
 *  good response, so they can answer in their own words and survive a follow-up. */
export interface QnAItem {
  question: string;
  answer_should_cover: string[];
  draw_on: string;
}

export interface InterviewQnA {
  questions: QnAItem[];
}

export interface ApplicationOut {
  id: string;
  job_description_id: string | null;
  resume_document_id: string | null;
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
  resume_document_id?: string;
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
  jdText?: string,
  resumeDocumentId?: string
): Promise<ApplicationOut> {
  return authedFetch(`/applications/${applicationId}/interview-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      round_type: roundType,
      jd_text: jdText || undefined,
      resume_document_id: resumeDocumentId || undefined,
    }),
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
  // An interview time in an email is a wall-clock time with no offset, so the server needs to be
  // told which zone to read it in - only the browser knows. See gmail_service._parse_iso.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
  return authedFetch(`/gmail/sync${query}`, { method: "POST" });
}
