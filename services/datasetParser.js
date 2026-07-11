const XLSX = require("xlsx");

function detectColumnType(rows, columnName) {
  const sample = rows.slice(0, 50).map((r) => r[columnName]);
  const numericCount = sample.filter(
    (v) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v))
  ).length;
  return numericCount / sample.length > 0.8 ? "numeric" : "categorical";
}

function parseDatasetBuffer(buffer, originalFilename) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows.length) {
    throw new Error("No rows found in uploaded file");
  }

  const columnNames = Object.keys(rawRows[0]);

  const columns = columnNames.map((name) => ({
    name,
    type: detectColumnType(rawRows, name),
  }));

  const rows = rawRows.map((row) => {
    const cleaned = {};
    for (const col of columns) {
      const val = row[col.name];
      cleaned[col.name] = col.type === "numeric" && val !== "" ? Number(val) : val;
    }
    return cleaned;
  });

  return { columns, rows, rowCount: rows.length };
}

module.exports = { parseDatasetBuffer };