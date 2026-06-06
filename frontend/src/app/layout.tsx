import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduAI — AI Quiz & Performance Analytics",
  description:
    "Generate quizzes, analyze performance, predict risks, and deliver personalized learning paths for learners and schools.",
};

// Set the theme before paint to avoid a flash of the wrong theme.
const themeScript = `
  try {
    var t = localStorage.getItem('edtech_theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
