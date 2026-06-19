import { validateDoctorImportRows } from "./doctorImport.js";

const utf8 = new TextDecoder("utf-8");

export async function parseDoctorImportWorkbook(file) {
  if (!file?.name?.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("รองรับเฉพาะไฟล์ .xlsx เท่านั้น");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("ไฟล์มีขนาดเกิน 10 MB");

  const archive = await readZip(await file.arrayBuffer());
  const workbookXml = await archive.text("xl/workbook.xml");
  const relationshipsXml = await archive.text("xl/_rels/workbook.xml.rels");
  const sheetPath = findSheetPath(workbookXml, relationshipsXml, "Doctor Import");
  if (!sheetPath) throw new Error("ไม่พบชีต Doctor Import ในไฟล์นี้");

  const sharedStrings = archive.has("xl/sharedStrings.xml")
    ? parseSharedStrings(await archive.text("xl/sharedStrings.xml"))
    : [];
  const rows = parseWorksheet(await archive.text(sheetPath), sharedStrings);
  return validateDoctorImportRows(rows);
}

async function readZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const endOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("โครงสร้างไฟล์ Excel ไม่ถูกต้อง");
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = normalizePath(utf8.decode(bytes.slice(offset + 46, offset + 46 + nameLength)));
    entries.set(name, { compression, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  async function read(name) {
    const entry = entries.get(normalizePath(name));
    if (!entry) throw new Error(`ไฟล์ Excel ขาดส่วนประกอบ ${name}`);
    if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error("โครงสร้างไฟล์ Excel ไม่ถูกต้อง");
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const dataStart = entry.localOffset + 30 + nameLength + extraLength;
    const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
    if (entry.compression === 0) return compressed;
    if (entry.compression !== 8 || typeof DecompressionStream === "undefined") {
      throw new Error("Browser นี้ไม่รองรับการอ่านไฟล์ Excel กรุณาใช้ Chrome หรือ Edge เวอร์ชันล่าสุด");
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  return {
    has: (name) => entries.has(normalizePath(name)),
    text: async (name) => utf8.decode(await read(name))
  };
}

function findEndOfCentralDirectory(view) {
  const minimum = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("ไฟล์นี้ไม่ใช่ Excel .xlsx ที่ถูกต้อง");
}

function findSheetPath(workbookXml, relationshipsXml, sheetName) {
  const workbook = parseXml(workbookXml);
  const relationships = parseXml(relationshipsXml);
  const sheet = elements(workbook, "sheet")
    .find((item) => item.getAttribute("name") === sheetName);
  if (!sheet) return "";
  const relationshipId = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    || sheet.getAttribute("r:id")
    || sheet.getAttribute("id");
  const relationship = elements(relationships, "Relationship")
    .find((item) => item.getAttribute("Id") === relationshipId);
  if (!relationship) return "";
  const target = relationship.getAttribute("Target") || "";
  return target.startsWith("/") ? normalizePath(target.slice(1)) : normalizePath(`xl/${target}`);
}

function parseSharedStrings(xml) {
  const document = parseXml(xml);
  return elements(document, "si").map((item) => (
    elements(item, "t").map((text) => text.textContent || "").join("")
  ));
}

function parseWorksheet(xml, sharedStrings) {
  const document = parseXml(xml);
  return elements(document, "row").map((row) => {
    const values = [];
    values.sourceRow = Number(row.getAttribute("r")) || undefined;
    elements(row, "c").forEach((cell) => {
      const reference = cell.getAttribute("r") || "A1";
      const column = columnIndex(reference.replace(/\d+/g, ""));
      const type = cell.getAttribute("t");
      const valueNode = elements(cell, "v")[0];
      let value = "";
      if (type === "inlineStr") {
        value = elements(cell, "t").map((item) => item.textContent || "").join("");
      } else if (type === "s") {
        value = sharedStrings[Number(valueNode?.textContent || 0)] || "";
      } else {
        value = valueNode?.textContent || "";
      }
      values[column] = value;
    });
    return values;
  });
}

function parseXml(xml) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("อ่านโครงสร้าง XML ในไฟล์ Excel ไม่สำเร็จ");
  return document;
}

function elements(parent, localName) {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

function columnIndex(letters) {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function normalizePath(value) {
  const parts = [];
  value.replaceAll("\\", "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}
