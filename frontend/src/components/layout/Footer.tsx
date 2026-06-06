import Link from "next/link";
import { FiGithub, FiLinkedin, FiTwitter } from "react-icons/fi";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "For students", href: "#audience" },
      { label: "For schools", href: "#audience" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", href: "#faq" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];

const SOCIAL = [
  { label: "Twitter", href: "#", icon: FiTwitter },
  { label: "GitHub", href: "#", icon: FiGithub },
  { label: "LinkedIn", href: "#", icon: FiLinkedin },
];

export function Footer() {
  const year = 2026;
  return (
    <footer className="border-t border-border-default bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">
              AI-powered quizzes and performance analytics for learners and schools.
            </p>
            <div className="mt-4 flex gap-2">
              {SOCIAL.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold text-fg">{column.title}</h4>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border-default pt-6 sm:flex-row">
          <p className="text-sm text-subtle">© {year} EduAI. All rights reserved.</p>
          <p className="text-sm text-subtle">Powered by Gemini · Built for learning</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
