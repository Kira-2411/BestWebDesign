const fs = require('fs');
const path = require('path');

const VALID_COMBINATIONS = new Set([
  'A00', 'A01', 'B00', 'C00', 'C03', 'D01', 'D07', 'D08', 'D14', 'V00', 'H00',
]);

const VALID_REGIONS = new Set(['north', 'central', 'south', 'all']);
const VALID_TYPES = new Set(['public', 'private']);

function parseCsv(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '../..', filePath);
  const content = fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] ?? '').trim();
    });
    row._line = index + 2;
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadVerifiedDataset(dataDir = 'data') {
  const base = path.join(__dirname, '../..', dataDir);
  return {
    categories: parseCsv(path.join(base, 'categories.csv')),
    universities: parseCsv(path.join(base, 'universities-verified.csv')),
    majors: parseCsv(path.join(base, 'majors-verified.csv')),
    admissionCombos: parseCsv(path.join(base, 'admission-combos.csv')),
    cutoffs: parseCsv(path.join(base, 'cutoffs-verified.csv')),
    tuitionFees: parseCsv(path.join(base, 'tuition-fees.csv')),
  };
}

module.exports = {
  VALID_COMBINATIONS,
  VALID_REGIONS,
  VALID_TYPES,
  parseCsv,
  loadVerifiedDataset,
};
