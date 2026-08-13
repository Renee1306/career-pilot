import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconBriefcase,
  IconChart,
  IconChat,
  IconCheck,
  IconCompass,
  IconDocument,
  IconGlobe,
  IconMail,
  IconSearch,
  IconSparkle,
  IconTarget,
} from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../lib/useReveal";

/* ---------------------------------------------------------------------------
   Copy that a real launch should replace with real numbers/quotes lives in
   these two constants, deliberately grouped so they're easy to find. They are
   illustrative placeholders, not measured results.
   --------------------------------------------------------------------------- */

const STATS = [
  { value: "3 min", label: "From job post to a plain-English breakdown" },
  { value: "5", label: "Resume templates, all export-ready" },
  { value: "1 inbox", label: "Gmail scanned, applications updated for you" },
];

const QUOTES = [
  {
    quote:
      "I stopped guessing what a job ad actually wanted. The breakdown told me which requirements were hard, which were learnable, and what to say about the rest.",
    name: "Sample review",
    role: "Replace before launch",
  },
  {
    quote:
      "Tailoring my resume used to take an evening per application. Now I paste the description, review the suggested edits, and export.",
    name: "Sample review",
    role: "Replace before launch",
  },
  {
    quote:
      "The board updating itself from my inbox is the part I did not know I needed. No more forgetting which company replied.",
    name: "Sample review",
    role: "Replace before launch",
  },
];

const MARQUEE_ITEMS = [
  "Job Decoder",
  "Resume Builder",
  "Application Tracker",
  "Interview Prep",
  "Gmail Sync",
  "AI Copilot",
];

function Marquee() {
  // The track is rendered twice and animated to -50%, so the second copy is
  // exactly where the first started when the loop restarts - no visible seam.
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {items.map((item, i) => (
          <span className="marquee-item" key={`${item}-${i}`}>
            {item} <span className="marquee-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual-glow" />

      <div className="hero-card hero-card-back">
        <div className="hero-card-label">Match score</div>
        <div className="hero-card-value">86%</div>
        <div className="hero-skeleton" style={{ width: "86%" }} />
        <div className="hero-skeleton" style={{ width: "62%" }} />
        <div className="hero-skeleton" style={{ width: "74%" }} />
      </div>

      <div className="hero-card hero-card-main">
        <div className="hero-card-label">Your pipeline</div>
        <div className="hero-row">
          <span className="hero-row-name">Northwind Labs</span>
          <span className="badge badge-success">Offer</span>
        </div>
        <div className="hero-row">
          <span className="hero-row-name">Kite &amp; Co.</span>
          <span className="badge badge-warning">Interview</span>
        </div>
        <div className="hero-row">
          <span className="hero-row-name">Helio Systems</span>
          <span className="badge badge-info">Applied</span>
        </div>
        <div className="hero-row">
          <span className="hero-row-name">Marlow Group</span>
          <span className="badge badge-muted">Drafting</span>
        </div>
      </div>

      <div className="hero-card hero-card-front">
        <div className="hero-card-label">Resume · tailored</div>
        <div className="hero-card-value" style={{ fontSize: 18 }}>
          Product Analyst
        </div>
        <div className="hero-skeleton" style={{ width: "100%" }} />
        <div className="hero-skeleton" style={{ width: "80%" }} />
        <div className="pill-list" style={{ marginTop: 12 }}>
          <span className="badge badge-primary">SQL</span>
          <span className="badge badge-primary">Python</span>
          <span className="badge badge-muted">+6</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const revealRef = useReveal<HTMLDivElement>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryHref = session ? "/dashboard" : "/login?mode=sign_up";
  const primaryLabel = session ? "Open dashboard" : "Get started free";

  return (
    <div className="marketing" ref={revealRef}>
      <header className={"marketing-nav" + (scrolled ? " marketing-nav-scrolled" : "")}>
        <div className="shell marketing-nav-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <IconCompass size={19} />
            </span>
            CareerPilot
          </Link>

          <nav className="marketing-nav-links">
            <a className="marketing-nav-link" href="#features">
              Features
            </a>
            <a className="marketing-nav-link" href="#workflow">
              Workflow
            </a>
            <a className="marketing-nav-link" href="#tracker">
              Tracker
            </a>
            <a className="marketing-nav-link" href="#reviews">
              Reviews
            </a>
          </nav>

          <div className="marketing-nav-cta">
            {session ? (
              <Link to="/dashboard" className="btn btn-primary btn-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link to="/login?mode=sign_up" className="btn btn-primary btn-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero ------------------------------------------------------------- */}
      <section className="hero">
        <div className="shell hero-inner">
          <div className="reveal">
            <span className="eyebrow">
              <IconSparkle size={13} /> AI career copilot
            </span>
            <h1 className="hero-title">
              Land The Job,
              <br />
              Not Just
              <span className="hero-title-mark">
                <IconTarget size={24} />
              </span>
              <br />
              The Application
            </h1>
            <p className="hero-lead">
              CareerPilot reads the job description, rewrites your resume against it, prepares your
              interview answers, and keeps every application on one board — updated straight from
              your inbox.
            </p>
            <div className="hero-actions">
              <Link to={primaryHref} className="btn btn-primary btn-lg">
                {primaryLabel} <IconArrowRight size={17} />
              </Link>
              <a href="#workflow" className="btn btn-ghost btn-lg">
                See how it works
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack">
                <span style={{ background: "var(--color-primary-soft)" }}>A</span>
                <span style={{ background: "var(--color-accent-soft)" }}>M</span>
                <span style={{ background: "var(--color-success-soft)" }}>J</span>
                <span style={{ background: "var(--color-info-soft)" }}>S</span>
              </div>
              <div className="hero-proof-text">
                <strong>Built for the messy middle of a job hunt</strong>
                Resume, research, tracking and prep in one place
              </div>
            </div>
          </div>

          <div className="reveal">
            <HeroVisual />
          </div>
        </div>
      </section>

      <Marquee />

      {/* Features --------------------------------------------------------- */}
      <section className="section section-alt" id="features">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow eyebrow-plain">Our features</span>
            <h2 className="section-title-lg">Four Tools That Do The Job-Hunt Grunt Work</h2>
            <p className="section-lead">
              Each one works on its own. Together they cover the whole loop, from reading a posting
              to walking into the interview.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconSearch size={20} />
              </div>
              <span className="feature-index">01</span>
              <h3>Decode any job post</h3>
              <p>
                Paste a description and get a plain-language summary, the three real
                responsibilities, and requirements split into hard, learnable and bonus — each with
                the line from the posting that proves it.
              </p>
            </article>

            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconDocument size={20} />
              </div>
              <span className="feature-index">02</span>
              <h3>Build a resume that fits</h3>
              <p>
                A structured editor with five templates, a curated font set and print-perfect A4
                export. Paste a job description and review suggested edits one at a time — nothing
                changes until you accept it.
              </p>
            </article>

            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconBriefcase size={20} />
              </div>
              <span className="feature-index">03</span>
              <h3>Track every application</h3>
              <p>
                A drag-and-drop board across Applied, Interview, Offer and Rejected, with a typed
                timeline per company — interviews, case studies, deadlines and attachments included.
              </p>
            </article>

            <article className="feature-card feature-card-dark reveal">
              <div className="feature-icon">
                <IconChat size={20} />
              </div>
              <span className="feature-index" style={{ color: "var(--color-accent)" }}>
                04
              </span>
              <h3>Walk in prepared</h3>
              <p>
                HR and technical question sets grounded in your actual resume, plus a company
                snapshot and a copilot that already knows the role you are looking at.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Workflow --------------------------------------------------------- */}
      <section className="section section-dark" id="workflow">
        <div className="shell showcase">
          <div className="reveal">
            <span className="eyebrow eyebrow-on-dark">How it works</span>
            <h2 className="section-title-lg">Meet A Job Hunt Without The Guesswork</h2>
            <p className="section-lead">
              Four steps, in the order you actually do them. Nothing is generated behind your back —
              every AI change is shown to you before it lands.
            </p>

            <ol className="step-list">
              <li className="step-item">
                <span className="step-num">01</span>
                <div className="step-body">
                  <h4>Paste the job description</h4>
                  <p>Get the explanation and a realistic typical-day preview, in any language.</p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num">02</span>
                <div className="step-body">
                  <h4>Tailor your resume</h4>
                  <p>
                    Import an existing PDF or start from scratch, then adopt suggested edits one by
                    one.
                  </p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num">03</span>
                <div className="step-body">
                  <h4>Apply and track</h4>
                  <p>Drop the company on the board; connect Gmail and the board keeps itself current.</p>
                </div>
              </li>
              <li className="step-item">
                <span className="step-num">04</span>
                <div className="step-body">
                  <h4>Prepare for the room</h4>
                  <p>Generate question sets grounded in your resume, not in invented experience.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="reveal">
            <div className="mock-window">
              <div className="mock-window-bar">
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-window-title">Job Analysis</span>
              </div>
              <div className="mock-window-body">
                <div className="mock-row">
                  <div>
                    <strong>Senior Product Analyst</strong>
                    <div className="mock-row-sub">Requirements · 3 hard · 4 learnable</div>
                  </div>
                  <span className="badge badge-primary">Decoded</span>
                </div>
                <div className="mock-row">
                  <div>
                    <strong>Typical day</strong>
                    <div className="mock-row-sub">Where the hours actually go</div>
                  </div>
                  <span className="badge badge-warning">Preview</span>
                </div>
                <div style={{ padding: "4px 2px" }}>
                  <div className="progress-row">
                    <span className="progress-row-label">Analysis &amp; problem solving</span>
                    <span className="progress-track">
                      <span className="progress-fill" style={{ width: "38%" }} />
                    </span>
                    <span className="progress-value">38</span>
                  </div>
                  <div className="progress-row">
                    <span className="progress-row-label">Meetings &amp; communication</span>
                    <span className="progress-track">
                      <span className="progress-fill" style={{ width: "24%" }} />
                    </span>
                    <span className="progress-value">24</span>
                  </div>
                  <div className="progress-row">
                    <span className="progress-row-label">Technical development</span>
                    <span className="progress-track">
                      <span className="progress-fill" style={{ width: "22%" }} />
                    </span>
                    <span className="progress-value">22</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-strip">
              {STATS.map((stat) => (
                <div className="stat-strip-item" key={stat.label}>
                  <div className="stat-strip-value">{stat.value}</div>
                  <div className="stat-strip-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tracker ---------------------------------------------------------- */}
      <section className="section" id="tracker">
        <div className="shell showcase showcase-reverse">
          <div className="reveal">
            <div className="mock-window">
              <div className="mock-window-bar">
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-window-title">Applications</span>
              </div>
              <div className="mock-window-body">
                <div className="mock-row">
                  <div>
                    <strong>Northwind Labs</strong>
                    <div className="mock-row-sub">Interview · Thu 14:00 · link attached</div>
                  </div>
                  <span className="badge badge-warning">Interview</span>
                </div>
                <div className="mock-row">
                  <div>
                    <strong>Helio Systems</strong>
                    <div className="mock-row-sub">Case study · due in 3 days · 1 PDF</div>
                  </div>
                  <span className="badge badge-info">Applied</span>
                </div>
                <div className="mock-row">
                  <div>
                    <strong>Kite &amp; Co.</strong>
                    <div className="mock-row-sub">Detected from Gmail · 2 hours ago</div>
                  </div>
                  <span className="badge badge-success">Offer</span>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal">
            <span className="eyebrow">Stay on top of it</span>
            <h2 className="section-title-lg">Your Inbox Updates The Board For You</h2>
            <p className="section-lead">
              Connect Gmail once. CareerPilot filters for application mail, reads only what matters,
              and files each update as a typed timeline entry — interview times, case-study
              deadlines and attachments included. Every message is classified once, ever.
            </p>

            <ul className="check-list" style={{ marginTop: 24 }}>
              <li>
                <span className="auth-side-check">
                  <IconCheck size={12} />
                </span>
                Drag a card between columns to change its status
              </li>
              <li>
                <span className="auth-side-check">
                  <IconCheck size={12} />
                </span>
                Per-company timeline you can edit entry by entry
              </li>
              <li>
                <span className="auth-side-check">
                  <IconCheck size={12} />
                </span>
                Company snapshot and interview questions on the same page
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Marquee />

      {/* Extras ----------------------------------------------------------- */}
      <section className="section section-alt">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow eyebrow-plain">And the small things</span>
            <h2 className="section-title-lg">Details That Save The Evening</h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconGlobe size={20} />
              </div>
              <h3>Read it in your language</h3>
              <p>
                Translate the whole job explanation or typical-day preview, and switch back to the
                original at any time. Translations are saved, not regenerated.
              </p>
            </article>
            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconChart size={20} />
              </div>
              <h3>See the pipeline, not a list</h3>
              <p>
                The dashboard totals your applications, interviews and offers, and shows how the
                funnel is actually converting.
              </p>
            </article>
            <article className="feature-card reveal">
              <div className="feature-icon">
                <IconMail size={20} />
              </div>
              <h3>Nothing invented</h3>
              <p>
                Suggested resume edits are grounded in what your resume already says. Skills are
                filtered against your real skill set, so the model cannot add one.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Reviews ---------------------------------------------------------- */}
      <section className="section" id="reviews">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow eyebrow-plain">What people say</span>
            <h2 className="section-title-lg">Written For The Person Doing The Applying</h2>
          </div>

          <div className="quote-grid">
            {QUOTES.map((item) => (
              <article className="quote-card reveal" key={item.quote}>
                <div className="quote-stars">★★★★★</div>
                <p>“{item.quote}”</p>
                <div className="quote-person">
                  <span className="avatar">{item.name.charAt(0)}</span>
                  <div>
                    <div className="quote-person-name">{item.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {item.role}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + footer ----------------------------------------------------- */}
      <section className="section-tight">
        <div className="shell">
          <div className="cta-band reveal">
            <span className="eyebrow eyebrow-on-dark">Ready when you are</span>
            <h2>Start With One Job Description</h2>
            <p>
              Paste a posting you are considering and see the whole loop — explanation, tailored
              resume, tracked application, interview prep.
            </p>
            <div className="cta-actions">
              <Link to={primaryHref} className="btn btn-accent btn-lg">
                {primaryLabel} <IconArrowRight size={17} />
              </Link>
              {!session && (
                <Link to="/login" className="btn btn-ghost-light btn-lg">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>

        <footer className="site-footer">
          <div className="shell site-footer-inner">
            <Link to="/" className="brand">
              <span className="brand-mark">
                <IconCompass size={19} />
              </span>
              CareerPilot
            </Link>
            <div className="site-footer-links">
              <a href="#features">Features</a>
              <a href="#workflow">Workflow</a>
              <a href="#tracker">Tracker</a>
              <a href="#reviews">Reviews</a>
              <Link to="/login">Sign in</Link>
            </div>
            <div className="site-footer-note">
              © {new Date().getFullYear()} CareerPilot · Your data stays in your own account
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
