import { useState } from "react";
import { getEffectiveSectionOrder, type BasicInfo, type CustomSection, type ResumeContent } from "../../lib/api";
import AwardsForm from "./AwardsForm";
import BasicInfoForm from "./BasicInfoForm";
import CertificatesForm from "./CertificatesForm";
import CustomSectionForm from "./CustomSectionForm";
import EducationForm from "./EducationForm";
import JDCustomizeModal from "./JDCustomizeModal";
import LanguagesForm from "./LanguagesForm";
import ProjectsForm from "./ProjectsForm";
import ReferencesForm from "./ReferencesForm";
import SkillsForm from "./SkillsForm";
import SummaryForm from "./SummaryForm";
import VolunteerForm from "./VolunteerForm";
import WorkExperienceForm from "./WorkExperienceForm";

const SECTION_LABELS: Record<string, string> = {
  summary: "Personal Statement",
  work_experience: "Work Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certificates: "Certificates",
  awards: "Awards",
  languages: "Languages",
  volunteer: "Volunteer",
  references: "References",
};

export default function SectionList({
  documentId,
  content,
  photoUrl,
  onContentChange,
  onPhotoUrlChange,
  onEnhance,
}: {
  documentId: string;
  content: ResumeContent;
  photoUrl: string | null;
  onContentChange: (content: ResumeContent) => void;
  onPhotoUrlChange: (url: string | null) => void;
  onEnhance: (text: string, context?: string) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState<string | null>("basic_info");
  const [jdModalOpen, setJdModalOpen] = useState(false);

  const toggleExpanded = (key: string) => setExpanded((cur) => (cur === key ? null : key));

  const effectiveOrder = getEffectiveSectionOrder(content);

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= effectiveOrder.length) return;
    const order = [...effectiveOrder];
    [order[index], order[target]] = [order[target], order[index]];
    onContentChange({ ...content, section_order: order });
  };

  const toggleEnabled = (key: string) => {
    const current = content.enabled_sections[key] ?? true;
    onContentChange({
      ...content,
      enabled_sections: { ...content.enabled_sections, [key]: !current },
    });
  };

  const setBasicInfo = (basic_info: BasicInfo) => onContentChange({ ...content, basic_info });

  const addCustomSection = () => {
    const section: CustomSection = { id: crypto.randomUUID(), title: "Custom Section", content: "" };
    const key = `custom:${section.id}`;
    onContentChange({
      ...content,
      custom_sections: [...content.custom_sections, section],
      section_order: [...effectiveOrder, key],
      enabled_sections: { ...content.enabled_sections, [key]: true },
    });
    setExpanded(key);
  };

  const updateCustomSection = (id: string, patch: Partial<CustomSection>) => {
    onContentChange({
      ...content,
      custom_sections: content.custom_sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeCustomSection = (id: string) => {
    const key = `custom:${id}`;
    const enabled = { ...content.enabled_sections };
    delete enabled[key];
    onContentChange({
      ...content,
      custom_sections: content.custom_sections.filter((s) => s.id !== id),
      section_order: effectiveOrder.filter((k) => k !== key),
      enabled_sections: enabled,
    });
  };

  return (
    <div className="builder-sections">
      <button
        type="button"
        className="btn btn-secondary"
        style={{ width: "100%", marginBottom: 14 }}
        onClick={() => setJdModalOpen(true)}
      >
        ✨ Customize for a JD
      </button>

      <div className="builder-section-item">
        <div className="builder-section-header" onClick={() => toggleExpanded("basic_info")}>
          <strong>Basic Info</strong>
          <span>{expanded === "basic_info" ? "−" : "+"}</span>
        </div>
        {expanded === "basic_info" && (
          <div style={{ padding: "0 4px 12px" }}>
            <BasicInfoForm
              documentId={documentId}
              basicInfo={content.basic_info}
              photoUrl={photoUrl}
              onChange={setBasicInfo}
              onPhotoUrlChange={onPhotoUrlChange}
            />
          </div>
        )}
      </div>

      {effectiveOrder.map((key, index) => {
        const isCustom = key.startsWith("custom:");
        const customSection = isCustom
          ? content.custom_sections.find((s) => s.id === key.slice("custom:".length))
          : undefined;
        if (isCustom && !customSection) return null;

        return (
          <div key={key} className="builder-section-item">
            <div className="builder-section-header">
              <div className="form-row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={content.enabled_sections[key] ?? true}
                  onChange={() => toggleEnabled(key)}
                />
                {isCustom && customSection ? (
                  <input
                    className="input"
                    style={{ padding: "4px 8px", fontSize: 13, width: 160 }}
                    value={customSection.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateCustomSection(customSection.id, { title: e.target.value })}
                  />
                ) : (
                  <span onClick={() => toggleExpanded(key)} style={{ cursor: "pointer" }}>
                    {SECTION_LABELS[key] ?? key}
                  </span>
                )}
              </div>
              <div className="form-row" style={{ gap: 4 }}>
                <button
                  type="button"
                  className="builder-reorder-btn"
                  disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="builder-reorder-btn"
                  disabled={index === effectiveOrder.length - 1}
                  onClick={() => moveSection(index, 1)}
                  title="Move down"
                >
                  ▼
                </button>
                {isCustom && customSection && (
                  <button
                    type="button"
                    className="link-button"
                    style={{ color: "var(--color-danger)" }}
                    onClick={() => removeCustomSection(customSection.id)}
                  >
                    Delete
                  </button>
                )}
                <span onClick={() => toggleExpanded(key)} style={{ cursor: "pointer" }}>
                  {expanded === key ? "−" : "+"}
                </span>
              </div>
            </div>
            {expanded === key && (
              <div style={{ padding: "0 4px 12px" }}>
                {key === "summary" && (
                  <SummaryForm
                    text={content.summary.text}
                    onChange={(text) => onContentChange({ ...content, summary: { text } })}
                    onEnhance={onEnhance}
                  />
                )}
                {key === "work_experience" && (
                  <WorkExperienceForm
                    entries={content.work_experience}
                    onChange={(work_experience) => onContentChange({ ...content, work_experience })}
                    onEnhance={onEnhance}
                  />
                )}
                {key === "education" && (
                  <EducationForm
                    entries={content.education}
                    onChange={(education) => onContentChange({ ...content, education })}
                  />
                )}
                {key === "projects" && (
                  <ProjectsForm
                    entries={content.projects}
                    onChange={(projects) => onContentChange({ ...content, projects })}
                  />
                )}
                {key === "skills" && (
                  <SkillsForm
                    items={content.skills.items}
                    onChange={(items) => onContentChange({ ...content, skills: { items } })}
                  />
                )}
                {key === "certificates" && (
                  <CertificatesForm
                    entries={content.certificates}
                    onChange={(certificates) => onContentChange({ ...content, certificates })}
                  />
                )}
                {key === "awards" && (
                  <AwardsForm
                    entries={content.awards}
                    onChange={(awards) => onContentChange({ ...content, awards })}
                  />
                )}
                {key === "languages" && (
                  <LanguagesForm
                    entries={content.languages}
                    onChange={(languages) => onContentChange({ ...content, languages })}
                  />
                )}
                {key === "volunteer" && (
                  <VolunteerForm
                    entries={content.volunteer}
                    onChange={(volunteer) => onContentChange({ ...content, volunteer })}
                  />
                )}
                {key === "references" && (
                  <ReferencesForm
                    entries={content.references}
                    onChange={(references) => onContentChange({ ...content, references })}
                  />
                )}
                {isCustom && customSection && (
                  <CustomSectionForm
                    content={customSection.content}
                    onChange={(text) => updateCustomSection(customSection.id, { content: text })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addCustomSection}>
        + Add custom section
      </button>

      {jdModalOpen && (
        <JDCustomizeModal
          documentId={documentId}
          content={content}
          onContentChange={onContentChange}
          onClose={() => setJdModalOpen(false)}
        />
      )}
    </div>
  );
}
