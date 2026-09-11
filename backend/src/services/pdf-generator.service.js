const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * HU-33 / MED-309: Generación del PDF inmutable del consentimiento informado.
 *
 * El contenido del documento ya fue renderizado desde la plantilla en la capa
 * de servicio (body content inmutable). Aquí solo se vuelca a un PDF legible
 * y se calcula su hash SHA-256, que será la base criptográfica de la firma
 * digital (MED-310): la firma se vincula al hash del PDF COMPLETO.
 */

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56.7;
const FONT_SIZE_BODY = 10;
const LINE_HEIGHT = 14;

function pushWrappedLines(text, font, size, maxWidth) {
  const words = String(text)
    .replace(/\r/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawDashedLine(page, { x, y, width }) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 0.75,
    color: rgb(0.6, 0.6, 0.6),
    dashArray: [3, 3]
  });
}

/**
 * Genera el buffer PDF del consentimiento y su digest SHA-256.
 *
 * @param {Object} options { title, folio, procedure, patient, doctor, content, generatedAt }
 * @returns {Promise<{ buffer: Buffer, sha256: string }>}
 */
async function renderConsentPdf(options) {
  const {
    title = 'CONSENTIMIENTO INFORMADO',
    folio = '',
    procedure = '',
    content = '',
    patient = {},
    doctor = {},
    generatedAt = new Date()
  } = options;

  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const fontBold = await document.embedFont(StandardFonts.HelveticaBold);

  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    return page;
  };

  const drawText = (text, { bold = false, size = FONT_SIZE_BODY, gapAfter = LINE_HEIGHT } = {}) => {
    let page = document.getPage(document.getPageCount() - 1);
    const usedFont = bold ? fontBold : font;
    const lines = pushWrappedLines(text, usedFont, size, maxWidth);
    for (const line of lines) {
      if (y - size < MARGIN) {
        page = newPage();
      }
      page.drawText(line, { x: MARGIN, y, size, font: usedFont, color: rgb(0, 0, 0) });
      y -= size + 2;
    }
    y -= (gapAfter - (size + 2));
    return page;
  };

  const page = newPage();
  page.drawText('MedicalSys - Centro Médico', {
    x: MARGIN,
    y: PAGE_HEIGHT - 45,
    size: 8,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });
  drawDashedLine(page, { x: MARGIN, y: PAGE_HEIGHT - 62, width: maxWidth });

  drawText(title, { bold: true, size: 14, gapAfter: 8 });
  drawText(`Folio: ${folio}`, { size: 9, gapAfter: 4 });
  drawText(`Procedimiento: ${procedure}`, { size: 9, gapAfter: 8 });

  const patientName = [patient.nombres, patient.apellidos].filter(Boolean).join(' ') || '—';
  const doctorName = [doctor.nombres, doctor.apellidos].filter(Boolean).join(' ') || '—';
  drawText(`Paciente: ${patientName}`, { size: 9, gapAfter: 2 });
  drawText(`C.I.: ${patient.documento_identidad || ''}`, { size: 9, gapAfter: 2 });
  drawText(`Médico responsable: ${doctorName}`, { size: 9, gapAfter: 6 });
  drawText(
    `Fecha de generación: ${generatedAt.toISOString().slice(0, 10)} ${generatedAt.toISOString().slice(11, 16)} (hora local UTC)`,
    { size: 9, gapAfter: 10 }
  );

  drawDashedLine(document.getPage(document.getPageCount() - 1), {
    x: MARGIN,
    y: y + 4,
    width: maxWidth
  });

  const paragraphs = String(content).split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    drawText(paragraph, { size: FONT_SIZE_BODY, gapAfter: 12 });
  }

  const buffer = Buffer.from(await document.save());
  const crypto = require('crypto');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, sha256 };
}

module.exports = { renderConsentPdf };