import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

export interface PdfPaperInfo {
  exam_type?: string;
  subject?: string;
  class?: string;
  duration?: string;
  total_marks?: number | string;
  chapters?: string[];
  chapters_covered?: string[];
}

export interface PdfQuestion {
  question_no?: number;
  marks?: number;
  question_text?: string;
  options?: string[] | null;
  section?: string | null;
  case_passage?: string | null;
  internal_choice?: boolean;
  choice_text?: string | null;
  choice_question_text?: string | null;
  [key: string]: unknown;
}

export interface PdfPaperData {
  paper_info?: PdfPaperInfo;
  instructions?: string[];
  questions?: PdfQuestion[];
}

export async function generatePaperPDF(
  paperData: PdfPaperData,
): Promise<{ filePath: string; fileName: string }> {
  const html = buildPaperHTML(paperData);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const outputDir = "./generated_papers";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `paper_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);

    await page.pdf({
      path: filePath,
      format: "A4",
      margin: {
        top: "1.5cm",
        bottom: "1.5cm",
        left: "2cm",
        right: "2cm",
      },
      printBackground: true,
    });

    console.log(`PDF generated: ${filePath}`);
    return { filePath, fileName };
  } finally {
    await browser.close();
  }
}

function buildPaperHTML(paperData: PdfPaperData): string {
  const {
    paper_info = {},
    instructions = [],
    questions = [],
  } = paperData || {};

  const sectionLabels: Record<string, string> = {
    A: "SECTION A - Multiple Choice Questions (1 Mark Each)",
    B: "SECTION B - Very Short Answer (2 Marks Each)",
    C: "SECTION C - Short Answer (3 Marks Each)",
    D: "SECTION D - Long Answer (5 Marks Each) - Internal Choice Provided",
    E: "SECTION E - Case-Based Questions (4 Marks Each)",
  };

  const hasSections = questions.some((q) => Boolean(q?.section));
  const examTitle = escapeHTML(
    String(paper_info.exam_type || "Question Paper").toUpperCase(),
  );
  const subject = escapeHTML(paper_info.subject || "");
  const stdClass = escapeHTML(paper_info.class || "");
  const duration = escapeHTML(paper_info.duration || "");
  const totalMarks = escapeHTML(String(paper_info.total_marks || ""));

  let questionsHTML = "";
  let currentSection: string | null = null;

  for (const q of questions) {
    if (hasSections && q.section && q.section !== currentSection) {
      currentSection = q.section;
      questionsHTML += `
        <div class="section-banner">
          ${escapeHTML(sectionLabels[q.section] || `Section ${q.section}`)}
        </div>
      `;
    }

    const passageHTML = q.case_passage
      ? `
      <div class="case-passage">
        <strong>Read the following and answer the questions below:</strong><br/><br/>
        ${formatMultilineText(q.case_passage)}
      </div>
    `
      : "";

    let optionsHTML = "";
    if (Array.isArray(q.options) && q.options.length === 4) {
      optionsHTML = `
        <table class="options-table">
          <tr>
            <td>${escapeHTML(q.options[0])}</td>
            <td>${escapeHTML(q.options[1])}</td>
          </tr>
          <tr>
            <td>${escapeHTML(q.options[2])}</td>
            <td>${escapeHTML(q.options[3])}</td>
          </tr>
        </table>
      `;
    }

    const choiceText = q.choice_text || q.choice_question_text;
    const choiceHTML =
      q.internal_choice && choiceText
        ? `
      <div class="or-divider">OR</div>
      <div class="question-text">${formatMultilineText(choiceText)}</div>
    `
        : "";

    questionsHTML += `
      <div class="question-block">
        <div class="question-header">
          <span class="q-number">Q${escapeHTML(String(q.question_no || ""))}.</span>
          <span class="marks-tag">[${escapeHTML(String(q.marks || ""))} Mark${Number(q.marks) > 1 ? "s" : ""}]</span>
        </div>
        ${passageHTML}
        <div class="question-text">${formatMultilineText(q.question_text)}</div>
        ${optionsHTML}
        ${choiceHTML}
      </div>
    `;
  }

  const instructionsHTML = Array.isArray(instructions)
    ? instructions
        .map((inst) => `<li>${escapeHTML(String(inst || ""))}</li>`)
        .join("")
    : "";

  const instructionsBlock = instructionsHTML
    ? `
      <div class="instructions-heading">General Instructions:</div>
      <ol class="instructions-list">
        ${instructionsHTML}
      </ol>
      <hr class="divider"/>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: "Nirmala UI", "Mangal", "Noto Serif Devanagari", "Times New Roman", serif;
          font-size: 11pt;
          color: #000;
          line-height: 1.5;
        }

        .exam-title {
          text-align: center;
          font-size: 14pt;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .exam-info {
          text-align: center;
          font-size: 10pt;
          margin-bottom: 4px;
        }

        .divider {
          border: none;
          border-top: 1.2px solid #000;
          margin: 8px 0;
        }

        .divider-thin {
          border: none;
          border-top: 0.6px solid #000;
          margin: 5px 0;
        }

        .student-info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 10pt;
          padding: 4px 0;
        }

        .instructions-heading {
          font-weight: bold;
          font-size: 10pt;
          margin-top: 6px;
          margin-bottom: 4px;
        }

        .instructions-list {
          padding-left: 20px;
          font-size: 9pt;
          margin-bottom: 6px;
        }

        .instructions-list li {
          margin-bottom: 2px;
        }

        .section-banner {
          background-color: #1a1a8c;
          color: #fff;
          text-align: center;
          font-weight: bold;
          font-size: 11pt;
          padding: 6px 10px;
          margin: 10px 0 6px 0;
          border-radius: 3px;
        }

        .question-block {
          margin-bottom: 8px;
          page-break-inside: auto;
          break-inside: auto;
        }

        .question-header {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 2px;
        }

        .q-number {
          font-weight: bold;
          font-size: 11pt;
          min-width: 28px;
        }

        .marks-tag {
          font-weight: bold;
          font-size: 9pt;
          white-space: nowrap;
          margin-left: auto;
        }

        .question-text {
          margin-left: 28px;
          margin-bottom: 2px;
          text-align: justify;
          white-space: normal;
        }

        .options-table {
          margin-left: 28px;
          margin-top: 3px;
          margin-bottom: 2px;
          width: 90%;
          font-size: 10pt;
        }

        .options-table td {
          padding: 2px 8px;
          width: 50%;
          vertical-align: top;
        }

        .case-passage {
          margin-left: 28px;
          margin-bottom: 6px;
          padding: 7px 10px;
          background-color: #f5f5f5;
          border-left: 3px solid #1a1a8c;
          font-style: italic;
          font-size: 10pt;
          text-align: justify;
        }

        .or-divider {
          text-align: center;
          font-weight: bold;
          margin: 5px 0;
          font-size: 10pt;
          color: #333;
        }

        .footer {
          margin-top: 20px;
          text-align: center;
          border-top: 1px solid #000;
          padding-top: 8px;
          font-size: 9pt;
        }
      </style>
    </head>
    <body>
      <div class="exam-title">${examTitle}</div>
      <div class="exam-info">
        Class: ${stdClass}
        &nbsp;&nbsp;&nbsp;&nbsp;
        Subject: ${subject}
        &nbsp;&nbsp;&nbsp;&nbsp;
        Max. Marks: ${totalMarks}
        &nbsp;&nbsp;&nbsp;&nbsp;
        Time: ${duration}
      </div>

      <hr class="divider"/>

      <div class="student-info">
        <span>Name: _________________________________</span>
        <span>Roll No: ___________</span>
        <span>Section: ________</span>
      </div>

      <hr class="divider-thin"/>

      ${instructionsBlock}

      ${questionsHTML}

      <div class="footer">End of Question Paper</div>
    </body>
    </html>
  `;
}

function formatMultilineText(value: unknown): string {
  return escapeHTML(String(value || "")).replace(/\n/g, "<br/>");
}

function escapeHTML(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
