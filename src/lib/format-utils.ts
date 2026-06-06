import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function formatSAR(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

const makeSafeFilename = (name: string) => {
  const stamp = new Date().toISOString().slice(0, 10);
  // replace any characters that are invalid in filenames
  const safe = name.replace(/[^a-z0-9._\-]/gi, "-");
  return `${safe}-${stamp}`;
};

export const downloadExcel = (data: unknown[], filename: string) => {
  let ws: XLSX.WorkSheet;
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    ws = XLSX.utils.aoa_to_sheet(data as Array<Array<string | number | undefined>>);
  } else {
    ws = XLSX.utils.json_to_sheet(data as Record<string, unknown>[]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, makeSafeFilename(filename) + ".xlsx");
};

export const downloadPDF = (
  title: string,
  headers: string[],
  data: (string | number)[][],
  filename: string,
  summary?: { label: string; value: string }[]
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.text(title, 40, 40);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 58);

  // Table
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 80,
    theme: "grid",
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      cellWidth: "wrap",
      overflow: "linebreak",
    },
    columnStyles: {},
  });
  
  // Summary section if provided
  if (summary && summary.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 40;
    const marginRight = 40;
    const labelX = marginLeft;
    const valueX = 220; // start of value column

    doc.setFontSize(12);
    doc.setTextColor(26, 26, 46);
    doc.text("Summary", marginLeft, finalY + 15);

    doc.setFontSize(10);
    let yPos = finalY + 30;
    const fontSize = 10;
    const lineHeight = fontSize * 1.2;

    summary.forEach((item) => {
      // handle page break
      if (yPos + lineHeight * 1.5 > pageHeight - 40) {
        doc.addPage();
        yPos = 40;
      }

      // label
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, "normal");
      doc.text(item.label + ":", labelX, yPos);

      // value: wrap to available width
      doc.setTextColor(26, 26, 46);
      const availableWidth = pageWidth - valueX - marginRight;
      const wrapped = doc.splitTextToSize(item.value, availableWidth);
      doc.text(wrapped, valueX, yPos);

      // advance y by number of wrapped lines
      yPos += Math.max(1, wrapped.length) * lineHeight + 6;
    });
  }
  
  doc.save(makeSafeFilename(filename) + ".pdf");
};
