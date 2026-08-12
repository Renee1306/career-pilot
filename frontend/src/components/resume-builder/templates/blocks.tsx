import { getEffectiveSectionOrder, type ResumeContent } from "../../../lib/api";

export function SummaryBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <section className="resume-section">
      <h2>Personal Statement</h2>
      <p>{text}</p>
    </section>
  );
}

export function ExperienceBlock({ entries }: { entries: ResumeContent["work_experience"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Work Experience</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>
              {entry.position || "Position"}
              {entry.company ? ` · ${entry.company}` : ""}
            </strong>
            <span className="resume-entry-dates">
              {[entry.start_date, entry.end_date].filter(Boolean).join(" – ")}
            </span>
          </div>
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function EducationBlock({ entries }: { entries: ResumeContent["education"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Education</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>
              {entry.school || "School"}
              {entry.major ? ` · ${entry.major}` : ""}
            </strong>
            <span className="resume-entry-dates">
              {[entry.start_date, entry.end_date].filter(Boolean).join(" – ")}
            </span>
          </div>
          {entry.degree && <div className="resume-entry-subtitle">{entry.degree}</div>}
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function ProjectsBlock({ entries }: { entries: ResumeContent["projects"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Projects</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>{entry.name || "Project"}</strong>
            <span className="resume-entry-dates">{entry.period}</span>
          </div>
          {entry.website && <div className="resume-entry-subtitle">{entry.website}</div>}
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function SkillsBlock({ items }: { items: string[] }) {
  const skills = items.filter((s) => s.trim());
  if (skills.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Skills</h2>
      <div className="resume-skill-list">
        {skills.map((skill, i) => (
          <span className="resume-skill-pill" key={i}>
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}

export function CertificatesBlock({ entries }: { entries: ResumeContent["certificates"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Certificates</h2>
      {entries.map((entry) => (
        <div className="resume-entry resume-entry-compact" key={entry.id}>
          <span>{entry.name}</span>
          <span className="resume-entry-dates">{entry.date}</span>
        </div>
      ))}
    </section>
  );
}

export function AwardsBlock({ entries }: { entries: ResumeContent["awards"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Awards</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>
              {entry.title || "Award"}
              {entry.awarder ? ` · ${entry.awarder}` : ""}
            </strong>
            <span className="resume-entry-dates">{entry.date}</span>
          </div>
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function LanguagesBlock({ entries }: { entries: ResumeContent["languages"] }) {
  const languages = entries.filter((e) => e.language.trim());
  if (languages.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Languages</h2>
      <div className="resume-skill-list">
        {languages.map((entry) => (
          <span className="resume-skill-pill" key={entry.id}>
            {entry.language} · {entry.fluency}
          </span>
        ))}
      </div>
    </section>
  );
}

export function VolunteerBlock({ entries }: { entries: ResumeContent["volunteer"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>Volunteer</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>
              {entry.role || "Role"}
              {entry.organization ? ` · ${entry.organization}` : ""}
            </strong>
            <span className="resume-entry-dates">
              {[entry.start_date, entry.end_date].filter(Boolean).join(" – ")}
            </span>
          </div>
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function ReferencesBlock({ entries }: { entries: ResumeContent["references"] }) {
  if (entries.length === 0) return null;
  return (
    <section className="resume-section">
      <h2>References</h2>
      {entries.map((entry) => (
        <div className="resume-entry" key={entry.id}>
          <div className="resume-entry-header">
            <strong>
              {entry.name || "Reference"}
              {entry.relationship ? ` · ${entry.relationship}` : ""}
            </strong>
            <span className="resume-entry-dates">{entry.contact}</span>
          </div>
          {entry.description && <p>{entry.description}</p>}
        </div>
      ))}
    </section>
  );
}

export function CustomSectionBlock({ title, content }: { title: string; content: string }) {
  if (!content.trim()) return null;
  return (
    <section className="resume-section">
      <h2>{title || "Custom Section"}</h2>
      <p>{content}</p>
    </section>
  );
}

export function ContactLine({ basicInfo }: { basicInfo: ResumeContent["basic_info"] }) {
  const parts = [basicInfo.location, basicInfo.email, basicInfo.phone].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="resume-contact-line">{parts.join(" · ")}</div>;
}

/** Renders one section by key - either a fixed SectionKey or a "custom:{id}" key -
 * shared by every template so section rendering logic only lives in one place. */
export function renderSectionBlock(key: string, content: ResumeContent) {
  switch (key) {
    case "summary":
      return <SummaryBlock key={key} text={content.summary.text} />;
    case "work_experience":
      return <ExperienceBlock key={key} entries={content.work_experience} />;
    case "education":
      return <EducationBlock key={key} entries={content.education} />;
    case "projects":
      return <ProjectsBlock key={key} entries={content.projects} />;
    case "skills":
      return <SkillsBlock key={key} items={content.skills.items} />;
    case "certificates":
      return <CertificatesBlock key={key} entries={content.certificates} />;
    case "awards":
      return <AwardsBlock key={key} entries={content.awards} />;
    case "languages":
      return <LanguagesBlock key={key} entries={content.languages} />;
    case "volunteer":
      return <VolunteerBlock key={key} entries={content.volunteer} />;
    case "references":
      return <ReferencesBlock key={key} entries={content.references} />;
    default:
      if (key.startsWith("custom:")) {
        const id = key.slice("custom:".length);
        const section = content.custom_sections.find((s) => s.id === id);
        if (!section) return null;
        return <CustomSectionBlock key={key} title={section.title} content={section.content} />;
      }
      return null;
  }
}

export function SectionBlocks({ content }: { content: ResumeContent }) {
  return (
    <>
      {getEffectiveSectionOrder(content)
        .filter((key) => content.enabled_sections[key] ?? true)
        .map((key) => renderSectionBlock(key, content))}
    </>
  );
}
