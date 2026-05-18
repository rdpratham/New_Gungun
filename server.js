require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const fetch = require('node-fetch');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, BorderStyle, Table, TableRow, TableCell,
  WidthType, Footer, Header, PageNumber, ShadingType,
  convertInchesToTwip, TableBorders, VerticalAlign
} = require('docx');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior executive assistant specialising in corporate documentation for a company called Shorthills AI. Your only job is to produce a Minutes of Meeting document in one exact fixed structure. You never deviate from this structure. You never add extra sections. You never use markdown, bullet symbols, or bold text. You write in boardroom-grade English — crisp, precise, third-person, past tense for what was discussed, present tense for next steps.

OUTPUT FORMAT — produce exactly this, nothing else, no preamble, no closing note:

MINUTES OF MEETING
[Meeting Subject] × [Client or Other Party Name]


MEETING INFORMATION
Date:   [DD Month YYYY]
Time:   [H:MM AM/PM TZ]
Platform:   [Platform]
Duration:   Approximately [X] minutes
Attendees — [Internal Team Name]:   [Full names and roles]
Attendees — [Client Name]:   [Full names and roles if known]
Prepared by:   [Internal Team Name]


SUMMARY OF DISCUSSION
1.   [One crisp prose paragraph. 2-4 sentences. Covers one key topic or theme from the meeting. No sub-bullets. No bold. Senior executive tone. Third person. Example: "Aryan Kushwaha opened the session with a structured overview of Shorthills AI's healthcare-focused capabilities, positioning the company as a data and AI transformation partner with five to six years of sector-specific depth."]
2.   [Next topic paragraph]
3.   [Continue — minimum 8 points, maximum 12 points. Every major discussion thread must be represented. No filler, no repetition.]
...

NEXT STEPS — [CLIENT NAME IN ALL CAPS]
1   [Crisp imperative action item. Who does what. Include deadline if mentioned.]
2   [Next item]
...

NEXT STEPS — [INTERNAL TEAM NAME IN ALL CAPS]
1   [Crisp imperative action item. Person name + action + deadline.]
2   [Next item]
...


RULES YOU MUST NEVER BREAK:
- Never use bullet points (• or -) anywhere in the document
- Never use bold (**text**) or italic (*text*) formatting
- Never use markdown of any kind
- Never add a section not listed in the format above
- Never write a preamble before the document or a note after it
- Summary points are numbered prose paragraphs, not lists
- Next Steps use plain integers (1, 2, 3) flush left
- Language is always senior, boardroom-grade, third-person
- Minimum 8 summary points, maximum 12
- If two parties cannot be identified, label them Internal Team and External Participants
- Always infer context from the transcript — do not leave placeholders`;

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function truncateTranscript(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  const trimmed = text.slice(0, maxChars);
  const lastPeriod = trimmed.lastIndexOf('.');
  return lastPeriod > maxChars * 0.8 ? trimmed.slice(0, lastPeriod + 1) : trimmed;
}

function buildUserMessage({ subject, datetime, internal_team, internal_attendees, client_name, client_attendees, platform, transcript }) {
  const safeTranscript = truncateTranscript(transcript || '', 12000);
  return `Meeting Subject: ${subject}
Date & Time: ${datetime}
Internal Team: ${internal_team}
Internal Attendees: ${internal_attendees}
Client / Other Party: ${client_name}
Client Attendees: ${client_attendees}
Platform: ${platform}

TRANSCRIPT:
${safeTranscript}

Generate the Minutes of Meeting document now. Follow the format exactly.`;
}

// ─── ROUTES ────────────────────────────────────────────────────────────────────

app.post('/generate', async (req, res) => {
  try {
    const { subject, datetime, internal_team, internal_attendees, client_name, client_attendees, platform, transcript } = req.body;
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(req.body) }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return res.status(502).json({ error: `Groq API error ${response.status}`, detail: errText });
    }

    const data = await response.json();
    const mom = data.choices?.[0]?.message?.content || '';
    res.json({ mom });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

app.post('/upload-transcript', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    res.json({ transcript: result.value });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to extract text from document.', detail: err.message });
  }
});

// ─── DOCX DOWNLOAD ─────────────────────────────────────────────────────────────

app.post('/download/docx', async (req, res) => {
  try {
    const { mom, subject } = req.body;
    if (!mom) return res.status(400).json({ error: 'MOM content required.' });

    const parsed = parseMOM(mom);
    const doc = buildDocx(parsed);
    const buffer = await Packer.toBuffer(doc);

    const filename = `MOM_${(subject || 'meeting').replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX error:', err);
    res.status(500).json({ error: 'Failed to generate Word document.', detail: err.message });
  }
});

// ─── PDF DOWNLOAD ──────────────────────────────────────────────────────────────

app.post('/download/pdf', async (req, res) => {
  try {
    const { mom, subject } = req.body;
    if (!mom) return res.status(400).json({ error: 'MOM content required.' });

    const html = buildPDFHtml(mom);
    const pdf = await renderPDF(html);

    const filename = `MOM_${(subject || 'meeting').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF.', detail: err.message });
  }
});

// ─── MOM PARSER ────────────────────────────────────────────────────────────────

function parseMOM(text) {
  const lines = text.split('\n');
  const result = {
    title: 'MINUTES OF MEETING',
    subtitle: '',
    infoLines: [],
    summaryPoints: [],
    nextStepsSections: []
  };

  let i = 0;

  // Find MINUTES OF MEETING
  while (i < lines.length && !lines[i].includes('MINUTES OF MEETING')) i++;
  i++;

  // Subtitle (next non-empty line)
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) {
    result.subtitle = lines[i].trim();
    i++;
  }

  // Skip to MEETING INFORMATION
  while (i < lines.length && !lines[i].includes('MEETING INFORMATION')) i++;
  i++;

  // Collect info lines until SUMMARY OF DISCUSSION
  while (i < lines.length && !lines[i].includes('SUMMARY OF DISCUSSION')) {
    const line = lines[i].trim();
    if (line) result.infoLines.push(line);
    i++;
  }
  i++;

  // Collect summary points until NEXT STEPS
  while (i < lines.length && !lines[i].trim().startsWith('NEXT STEPS')) {
    const line = lines[i].trim();
    if (/^\d+\.?\s+/.test(line)) {
      result.summaryPoints.push(line.replace(/^\d+\.?\s+/, '').trim());
    } else if (line && result.summaryPoints.length > 0) {
      // continuation of previous paragraph
      result.summaryPoints[result.summaryPoints.length - 1] += ' ' + line;
    }
    i++;
  }

  // Collect next steps sections
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('NEXT STEPS')) {
      const section = { heading: line, items: [] };
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('NEXT STEPS')) {
        const item = lines[i].trim();
        if (/^\d+\s+/.test(item)) {
          section.items.push(item.replace(/^\d+\s+/, '').trim());
        } else if (item && section.items.length > 0) {
          section.items[section.items.length - 1] += ' ' + item;
        }
        i++;
      }
      result.nextStepsSections.push(section);
    } else {
      i++;
    }
  }

  // Extract internal team from info lines for footer
  result.preparedBy = '';
  for (const line of result.infoLines) {
    if (line.toLowerCase().startsWith('prepared by')) {
      result.preparedBy = line.split(/:\s+/)[1] || '';
      break;
    }
  }

  return result;
}

// ─── DOCX BUILDER ──────────────────────────────────────────────────────────────

function buildDocx(parsed) {
  const children = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: 'MINUTES OF MEETING', bold: true, size: 64, font: 'Calibri', color: '000000' })],
    alignment: AlignmentType.CENTER,
  }));

  // Subtitle
  if (parsed.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: parsed.subtitle, size: 28, font: 'Calibri', color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }));
  }

  // Horizontal rule
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
    spacing: { after: 160 },
  }));

  // MEETING INFORMATION header
  children.push(new Paragraph({
    children: [new TextRun({ text: 'MEETING INFORMATION', bold: true, size: 22, font: 'Calibri', allCaps: true })],
    spacing: { before: 200, after: 120 },
  }));

  // Info lines as 2-col table
  const infoRows = parsed.infoLines.map(line => {
    const colonIdx = line.indexOf(':');
    const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
    const value = colonIdx >= 0 ? line.slice(colonIdx + 1).replace(/^\s+/, '') : '';
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label + ':', bold: true, size: 22, font: 'Calibri' })] })],
          width: { size: 2500, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 22, font: 'Calibri' })] })],
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        }),
      ],
    });
  });

  if (infoRows.length > 0) {
    children.push(new Table({
      rows: infoRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TableBorders.NONE,
    }));
  }

  // SUMMARY OF DISCUSSION header
  children.push(new Paragraph({
    children: [new TextRun({ text: 'SUMMARY OF DISCUSSION', bold: true, size: 22, font: 'Calibri', allCaps: true })],
    spacing: { before: 300, after: 160 },
  }));

  parsed.summaryPoints.forEach((pt, idx) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${idx + 1}.   ${pt}`, size: 22, font: 'Calibri' })],
      spacing: { after: 120 },
      indent: { left: 0 },
    }));
  });

  // Next steps sections
  parsed.nextStepsSections.forEach(section => {
    children.push(new Paragraph({
      children: [new TextRun({ text: section.heading, bold: true, size: 22, font: 'Calibri', allCaps: true })],
      spacing: { before: 300, after: 160 },
    }));
    section.items.forEach((item, idx) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${idx + 1}   ${item}`, size: 22, font: 'Calibri' })],
        spacing: { after: 100 },
        indent: { left: convertInchesToTwip(0.3) },
      }));
    });
  });

  const preparedBy = parsed.preparedBy || 'Shorthills AI';

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [new TextRun({ text: `Confidential — Prepared by ${preparedBy}`, size: 18, color: '888888', font: 'Calibri' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      children,
    }],
  });
}

// ─── PDF HTML BUILDER ──────────────────────────────────────────────────────────

function buildPDFHtml(mom) {
  const parsed = parseMOM(mom);

  const infoHtml = parsed.infoLines.map(line => {
    const colonIdx = line.indexOf(':');
    const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
    const value = colonIdx >= 0 ? line.slice(colonIdx + 1).replace(/^\s+/, '') : '';
    return `<tr><td class="info-label">${escHtml(label)}:</td><td class="info-value">${escHtml(value)}</td></tr>`;
  }).join('');

  const summaryHtml = parsed.summaryPoints.map((pt, i) =>
    `<p class="summary-point"><span class="num">${i + 1}.</span>   ${escHtml(pt)}</p>`
  ).join('');

  const nextStepsHtml = parsed.nextStepsSections.map(section =>
    `<h3 class="section-heading">${escHtml(section.heading)}</h3>` +
    section.items.map((item, i) =>
      `<p class="next-step"><span class="ns-num">${i + 1}</span>   ${escHtml(item)}</p>`
    ).join('')
  ).join('');

  const preparedBy = parsed.preparedBy || 'Shorthills AI';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; background: #fff; color: #111; font-size: 11px; line-height: 1.6; }
  .page { max-width: 750px; margin: 0 auto; padding: 60px; }
  .title { font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 4px; font-family: Georgia, serif; }
  .subtitle { font-size: 14px; color: #555; text-align: center; margin-bottom: 24px; font-family: system-ui, sans-serif; }
  hr { border: none; border-top: 1px solid #ccc; margin: 24px 0; }
  .section-heading { font-size: 11px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 28px; margin-bottom: 10px; font-family: system-ui, sans-serif; }
  table.info { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
  td.info-label { font-weight: bold; font-family: system-ui, sans-serif; width: 220px; vertical-align: top; padding: 1px 0; font-size: 11px; }
  td.info-value { font-family: Georgia, serif; vertical-align: top; padding: 1px 0; font-size: 11px; }
  .summary-point { font-size: 11px; line-height: 1.6; margin-bottom: 10px; font-family: Georgia, serif; }
  .summary-point .num { font-variant-numeric: tabular-nums; }
  .next-step { font-size: 11px; padding-left: 16px; margin-bottom: 6px; font-family: Georgia, serif; }
  .ns-num { font-variant-numeric: tabular-nums; }
  .footer { font-size: 9px; color: #888; text-align: right; margin-top: 40px; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
<div class="page">
  <div class="title">MINUTES OF MEETING</div>
  <div class="subtitle">${escHtml(parsed.subtitle)}</div>
  <hr/>
  <h3 class="section-heading">Meeting Information</h3>
  <table class="info"><tbody>${infoHtml}</tbody></table>
  <h3 class="section-heading">Summary of Discussion</h3>
  ${summaryHtml}
  ${nextStepsHtml}
  <div class="footer">Confidential — Prepared by ${escHtml(preparedBy)}</div>
</div>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderPDF(html) {
  let chromium, puppeteer;
  try {
    chromium = require('@sparticuz/chromium');
    puppeteer = require('puppeteer-core');
  } catch (e) {
    throw new Error('puppeteer-core or @sparticuz/chromium not installed: ' + e.message);
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '22mm', bottom: '22mm', left: '25mm', right: '25mm' },
    printBackground: true,
    scale: 0.95,
  });
  await browser.close();
  return pdf;
}

// ─── START ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MOM Generator running on port ${PORT}`));
