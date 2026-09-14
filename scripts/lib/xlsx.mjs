// Minimal .xlsx reader with no dependencies: a zip reader over node:zlib plus
// a cell parser for SpreadsheetML. Enough to read simple statistical workbooks.

import { inflateRawSync } from 'node:zlib';

/** Read all entries of a zip archive from a Buffer. Returns Map<path, Buffer>. */
export function readZip(buf) {
  // End of central directory record: signature 0x06054b50, search backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error(`Bad local header for ${name}`);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error(`Unsupported zip compression method ${method} for ${name}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');

/**
 * Parse an .xlsx Buffer into { sheets: Map<sheetName, rows> } where rows is
 * Map<rowNumber, Map<columnLetter, string|number>>. Formulas are read by cached value.
 */
export function readWorkbook(buf) {
  const files = readZip(buf);
  const text = (path) => {
    const f = files.get(path);
    if (!f) throw new Error(`Missing ${path} in workbook`);
    return f.toString('utf8');
  };
  const shared = [];
  if (files.has('xl/sharedStrings.xml')) {
    for (const si of text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeXml([...si[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('')));
    }
  }
  const rels = new Map();
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1])?.[1];
    const target = /Target="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  const sheets = new Map();
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(/name="([^"]+)"/.exec(m[1])?.[1] ?? '');
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1];
    const path = rels.get(rid);
    if (!path) continue;
    sheets.set(name, parseSheet(text(path), shared));
  }
  return { sheets };
}

function parseSheet(xml, shared) {
  const rows = new Map();
  for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, rowStr, attrs, inner = ''] = c;
    const row = Number(rowStr);
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    let value = null;
    const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
    if (type === 's' && v != null) value = shared[Number(v)];
    else if (type === 'inlineStr') value = decodeXml([...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join(''));
    else if (type === 'str') value = v != null ? decodeXml(v) : null;
    else if (v != null) value = Number(v);
    if (value === null) continue;
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row).set(col, value);
  }
  return rows;
}
