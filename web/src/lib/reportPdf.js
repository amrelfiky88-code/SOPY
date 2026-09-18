import { jpegPagesToPdf } from './pdf.js';

// Draws report blocks (reportModel.js) onto A4 canvases and packs them
// into a PDF. One page canvas at a time keeps memory low on phones, and
// A4 at 150dpi (1240×1754 ≈ 2.2M px) is well inside iOS's canvas limit.

const W = 1240;
const H = 1754;
const MARGIN = 96;
const FOOTER = 60;
const CONTENT_W = W - MARGIN * 2;
const FONT = '"Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';

const COLORS = {
  ink: '#1c231f',
  soft: '#5b6660',
  line: '#e2dccf',
  brand: '#1c3d2e',
  good: '#1f7a45',
  goodTint: '#e3f1e8',
  warn: '#a86a00',
  warnTint: '#fbefd5',
  bad: '#b3261e',
  badTint: '#f7e4e1',
  muted: '#8a938d',
  mutedTint: '#eeeeea',
};

const font = (size, weight = 400, family = FONT) => `${weight} ${size}px ${family}`;

// Each line's own direction comes from its first strong character, like
// the browser's `unicode-bidi: plaintext`. Drawing an English category
// with the page's RTL direction moved its trailing "&" to the front, and
// "1 / 1 (100%)" came out reversed.
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
function lineDirection(str) {
  for (const ch of String(str)) {
    if (RTL_CHAR.test(ch)) return 'rtl';
    if (LTR_CHAR.test(ch)) return 'ltr';
  }
  return 'ltr'; // digits and punctuation only
}

// Word-wrap for any script; words longer than the line are broken by
// character so a pasted URL can't run off the page.
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) { lines.push(chunk); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

async function loadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('photo');
  const blob = await res.blob();
  if (window.createImageBitmap) return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not render the page'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/jpeg', 0.85);
  });
}

/**
 * @param {{ title: string, blocks: object[] }} model
 * @param {{ dir: 'ltr'|'rtl', footer: (page: number) => string, photoMissing: string, critical: string }} opts
 * @returns {Promise<Blob>}
 */
export async function renderReportPdf(model, { dir, footer, photoMissing, critical }) {
  const rtl = dir === 'rtl';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.direction = dir;
  ctx.textBaseline = 'top';

  // x for text that starts at the reading edge / ends at the far edge.
  const startX = (indent = 0) => (rtl ? W - MARGIN - indent : MARGIN + indent);
  const endX = (indent = 0) => (rtl ? MARGIN + indent : W - MARGIN - indent);

  const photos = new Map();
  await Promise.all(
    [...new Set(model.blocks.filter((b) => b.photo).map((b) => b.photo))].map(async (url) => {
      try { photos.set(url, await loadImage(url)); } catch { photos.set(url, null); }
    })
  );

  const pages = [];
  let pageNo = 0;
  let y = 0;

  const startPage = () => {
    pageNo += 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // Thin brand rule across the top of every page.
    ctx.fillStyle = COLORS.brand;
    ctx.fillRect(0, 0, W, 14);
    y = MARGIN;
  };

  const finishPage = async () => {
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN, H - MARGIN + 8);
    ctx.lineTo(W - MARGIN, H - MARGIN + 8);
    ctx.stroke();
    text(footer(pageNo), startX(), H - MARGIN + 22, { size: 20, color: COLORS.soft });
    pages.push({ jpeg: await canvasToJpeg(canvas), width: W, height: H });
  };

  // Move to a fresh page if `height` more pixels won't fit.
  const ensure = async (height) => {
    if (y + height > H - MARGIN - FOOTER) {
      await finishPage();
      startPage();
    }
  };

  // `align` is relative to the page ('start' = the reading edge), so a
  // line keeps its place on an Arabic page even when drawn left-to-right.
  const physical = (align) => {
    if (align === 'center') return 'center';
    const atStart = align === 'start';
    return rtl === atStart ? 'right' : 'left';
  };

  const text = (str, x, top, { size = 26, weight = 400, color = COLORS.ink, align = 'start', family = FONT } = {}) => {
    ctx.font = font(size, weight, family);
    ctx.fillStyle = color;
    ctx.direction = lineDirection(str);
    ctx.textAlign = physical(align);
    ctx.fillText(str, x, top);
  };

  const pill = (label, tone, x, top, align) => {
    ctx.font = font(22, 600);
    const w = ctx.measureText(label).width + 28;
    const left = align === 'end' ? (rtl ? x : x - w) : (rtl ? x - w : x);
    ctx.fillStyle = COLORS[`${tone}Tint`] || COLORS.mutedTint;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, top, w, 36, 18); else ctx.rect(left, top, w, 36);
    ctx.fill();
    ctx.fillStyle = COLORS[tone] || COLORS.muted;
    ctx.direction = lineDirection(label);
    ctx.textAlign = 'center';
    ctx.fillText(label, left + w / 2, top + 6);
    return w;
  };

  // Layout of one checkpoint, measured before drawing so page breaks
  // (and headings that must stay with it) can be decided up front.
  const measureItem = (block) => {
    const pillSpace = 260;
    ctx.font = font(26, 500);
    const lines = wrap(ctx, block.text, CONTENT_W - pillSpace);
    ctx.font = font(22);
    const noteLines = block.note ? wrap(ctx, block.note, CONTENT_W - pillSpace) : [];
    const img = block.photo ? photos.get(block.photo) : undefined;
    let photoW = 0;
    let photoH = 0;
    if (block.photo) {
      if (img) {
        const scale = Math.min(460 / img.width, 345 / img.height, 1.5);
        photoW = Math.round(img.width * scale);
        photoH = Math.round(img.height * scale);
      } else {
        photoH = 34;
      }
    }
    const textH = lines.length * 36 + (block.critical ? 40 : 0) + noteLines.length * 30;
    return { lines, noteLines, img, photoW, photoH, height: textH + (photoH ? photoH + 16 : 0) + 30 };
  };

  // How much of the next block must fit alongside a heading, so a
  // heading never ends up alone at the bottom of a page.
  const keepWithNext = (next) => {
    if (!next) return 0;
    if (next.type === 'item') return Math.min(measureItem(next).height, 520);
    if (next.type === 'row') return 50;
    return 0;
  };

  startPage();

  for (let index = 0; index < model.blocks.length; index++) {
    const block = model.blocks[index];
    const next = model.blocks[index + 1];
    switch (block.type) {
      case 'title': {
        ctx.font = font(50, 700, SERIF);
        const lines = wrap(ctx, block.text, CONTENT_W);
        await ensure(lines.length * 62 + 60);
        lines.forEach((line) => { text(line, startX(), y, { size: 50, weight: 700, family: SERIF }); y += 62; });
        if (block.subtitle) { text(block.subtitle, startX(), y + 4, { size: 28, color: COLORS.soft }); y += 44; }
        y += 16;
        break;
      }
      case 'meta': {
        for (const [label, value] of block.rows) {
          ctx.font = font(24);
          const lines = wrap(ctx, value || '—', CONTENT_W - 300);
          await ensure(lines.length * 34 + 8);
          text(label, startX(), y, { size: 24, color: COLORS.soft });
          lines.forEach((line, i) => text(line, startX(300), y + i * 34, { size: 24, weight: 600 }));
          y += lines.length * 34 + 8;
        }
        y += 18;
        break;
      }
      case 'alert': {
        await ensure(70);
        ctx.fillStyle = COLORS.badTint;
        ctx.fillRect(MARGIN, y, CONTENT_W, 58);
        text(block.text, startX(20), y + 15, { size: 24, weight: 600, color: COLORS.bad });
        y += 78;
        break;
      }
      case 'score': {
        const boxH = block.extra ? 170 : 140;
        await ensure(boxH + 20);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.strokeRect(MARGIN, y, CONTENT_W, boxH);
        text(block.value, startX(28), y + 22, { size: 64, weight: 700, family: SERIF });
        text(block.detail, startX(28), y + 96, { size: 24, color: COLORS.soft });
        if (block.extra) text(block.extra, startX(28), y + 128, { size: 24, weight: 600, color: COLORS.bad });
        pill(block.badge, block.tone, endX(28), y + 30, 'end');
        y += boxH + 28;
        break;
      }
      case 'heading': {
        const after = next?.type === 'subheading' ? 60 + keepWithNext(model.blocks[index + 2]) : keepWithNext(next);
        await ensure(90 + after);
        y += 14;
        text(block.text, startX(), y, { size: 34, weight: 700, family: SERIF, color: COLORS.brand });
        y += 48;
        ctx.fillStyle = COLORS.line;
        ctx.fillRect(MARGIN, y, CONTENT_W, 2);
        y += 18;
        break;
      }
      case 'subheading': {
        ctx.font = font(24, 700);
        const lines = wrap(ctx, block.text, CONTENT_W);
        await ensure(lines.length * 32 + 20 + keepWithNext(next));
        y += 8;
        lines.forEach((line) => { text(line, startX(), y, { size: 24, weight: 700, color: COLORS.soft }); y += 32; });
        y += 6;
        break;
      }
      case 'row': {
        const labelW = CONTENT_W * 0.42;
        ctx.font = font(24);
        const labelLines = wrap(ctx, block.label, labelW - 20);
        const valueLines = wrap(ctx, block.value, CONTENT_W - labelW);
        const h = Math.max(labelLines.length, valueLines.length) * 34 + 16;
        await ensure(h);
        labelLines.forEach((line, i) => text(line, startX(), y + i * 34, { size: 24, color: COLORS.soft }));
        valueLines.forEach((line, i) => text(line, startX(labelW), y + i * 34, { size: 24, weight: 600, color: block.tone ? COLORS[block.tone] : COLORS.ink }));
        y += h;
        ctx.fillStyle = COLORS.line;
        ctx.fillRect(MARGIN, y - 8, CONTENT_W, 1);
        break;
      }
      case 'item': {
        const { lines, noteLines, img, photoW, photoH, height } = measureItem(block);
        await ensure(Math.min(height, H - MARGIN * 2 - FOOTER));

        lines.forEach((line, i) => text(line, startX(), y + i * 36, { size: 26, weight: 500 }));
        let cursor = y + lines.length * 36;
        if (block.result) pill(block.result, block.tone, endX(), y, 'end');
        if (block.critical) { pill(critical, 'bad', startX(), cursor + 4, 'start'); cursor += 40; }
        noteLines.forEach((line) => { text(line, startX(), cursor + 2, { size: 22, color: COLORS.soft }); cursor += 30; });
        if (block.photo) {
          cursor += 12;
          if (img) {
            const left = rtl ? W - MARGIN - photoW : MARGIN;
            ctx.drawImage(img, left, cursor, photoW, photoH);
            ctx.strokeStyle = COLORS.line;
            ctx.lineWidth = 2;
            ctx.strokeRect(left, cursor, photoW, photoH);
          } else {
            text(photoMissing, startX(), cursor, { size: 22, color: COLORS.muted });
          }
          cursor += photoH;
        }
        y = cursor + 22;
        ctx.fillStyle = COLORS.line;
        ctx.fillRect(MARGIN, y - 10, CONTENT_W, 1);
        break;
      }
      default:
        break;
    }
  }

  await finishPage();
  photos.forEach((img) => img?.close?.());
  return jpegPagesToPdf(pages, { title: model.title });
}
