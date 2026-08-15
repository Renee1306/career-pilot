import { IconBriefcase, IconChat, IconDocument, IconSearch, IconSparkle } from "./Icons";
import { supabase } from "../lib/supabaseClient";

const STEPS = [
  {
    icon: <IconSearch size={17} />,
    title: "1. Decode a job",
    sub: "Paste a job description to get a plain-language breakdown of what it's really asking for.",
  },
  {
    icon: <IconDocument size={17} />,
    title: "2. Tailor your resume",
    sub: "Import an existing resume or start fresh, then adopt suggested edits for a specific job.",
  },
  {
    icon: <IconBriefcase size={17} />,
    title: "3. Track it",
    sub: "Drop the application on your board - drag between columns as it moves along.",
  },
  {
    icon: <IconChat size={17} />,
    title: "4. Walk in prepared",
    sub: "Generate interview questions and a company snapshot for the role before you go in.",
  },
];

/** Shown on the dashboard for a first-time user until they dismiss it. Dismissal is written to
 *  the user's own Supabase auth record (`user_metadata.onboarding_dismissed`) rather than
 *  localStorage, so it stays dismissed across devices/browsers and survives a cleared cache - it's
 *  tied to the account, not the machine. `AuthContext`'s `onAuthStateChange` listener picks up the
 *  `updateUser` call's resulting `USER_UPDATED` event on its own, but the parent still flips local
 *  state immediately so the card disappears without waiting on that round trip. */
export default function OnboardingGuide({ onDismiss }: { onDismiss: () => void }) {
  const handleDismiss = () => {
    onDismiss();
    supabase.auth.updateUser({ data: { onboarding_dismissed: true } }).catch((err) => {
      console.warn("Failed to save onboarding dismissal:", err);
    });
  };

  return (
    <div className="card onboarding-card">
      <button
        type="button"
        className="onboarding-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss guide"
        title="Dismiss"
      >
        &times;
      </button>

      <span className="eyebrow">
        <IconSparkle size={13} /> New here?
      </span>
      <h2 style={{ marginTop: 10 }}>A quick tour of CareerPilot</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Four steps cover the whole loop, in the order you'd actually do them.
      </p>

      <div className="onboarding-steps">
        {STEPS.map((step) => (
          <div className="onboarding-step" key={step.title}>
            <span className="onboarding-step-icon">{step.icon}</span>
            <span className="onboarding-step-title">{step.title}</span>
            <span className="onboarding-step-sub">{step.sub}</span>
          </div>
        ))}
      </div>

      <div className="form-row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleDismiss}>
          Got it, thanks!
        </button>
      </div>
    </div>
  );
}
