// Minimal PDF writer: one JPEG image per A4 page. Pages are drawn on a
// canvas first (see reportPdf.js), so the browser's own text engine lays
// out Arabic (RTL, joined letters) and French exactly as on screen — PDF
// libraries' built-in fonts can't — and this stays dependency-free.

const A4_PT = { w: 595.28, h: 841.89 };

// PDF text strings: UTF-16BE hex with a BOM handles any language.
function pdfTextString(text) {
  let hex = 'FEFF';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 0xffff) {
      const v = code - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else {
      hex += code.toString(16).padStart(4, '0');
    }
  }
  return `<${hex.toUpperCase()}>`;
}

/**
 * @param {{ jpeg: Uint8Array, width: number, height: number }[]} pages
 * @param {{ title?: string }} [info]
 * @returns {Blob} application/pdf
 */
export function jpegPagesToPdf(pages, { title } = {}) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let offset = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const object = (n, ...parts) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n`);
    parts.forEach(push);
    push('\nendobj\n');
  };

  // Header; the binary comment line tells transfer tools this isn't text.
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // 1 catalog, 2 page tree, 3 info, then per page: page, content, image.
  const pageObj = (i) => 4 + i * 3;
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  object(3, `<< /Producer (SOPY)${title ? ` /Title ${pdfTextString(title)}` : ''} >>`);

  pages.forEach((page, i) => {
    const p = pageObj(i);
    const content = `q ${A4_PT.w} 0 0 ${A4_PT.h} 0 0 cm /Im0 Do Q`;
    object(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.w} ${A4_PT.h}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    object(p + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(
      p + 2,
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream'
    );
  });

  const count = 4 + pages.length * 3;
  const xrefAt = offset;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}
