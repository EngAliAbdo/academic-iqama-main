function escapeCsvCell(value: unknown) {
  const normalized = `${value ?? ""}`.replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

function escapeHtml(value: unknown) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export function downloadCsvFile(fileName: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n");

  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }), fileName);
}

export function openPrintWindow(title: string, headers: string[], rows: Array<Array<unknown>>) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");

  if (!popup) {
    return false;
  }

  const tableHead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tableBody = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  popup.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin-bottom: 16px; font-size: 22px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d1d5db; padding: 10px; text-align: right; vertical-align: top; font-size: 13px; }
      th { background: #f3f4f6; }
      @media print {
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <thead>
        <tr>${tableHead}</tr>
      </thead>
      <tbody>
        ${tableBody}
      </tbody>
    </table>
  </body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
