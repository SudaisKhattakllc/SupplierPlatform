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

export const downloadExcel = (data: Record<string, unknown>[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(
    wb,
    filename + "-" + new Date().toLocaleDateString() + ".xlsx"
  );
}

export const downloadPDF = (
  title: string,
  headers: string[],
  data: (string | number)[][],
  filename: string,
  summary?: { label: string; value: string }[]
) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.text(title, 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
  
  // Table
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 35,
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
      cellPadding: 3,
    },
  });
  
  // Summary section if provided
  if (summary && summary.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 50;
    doc.setFontSize(12);
    doc.setTextColor(26, 26, 46);
    doc.text("Summary", 14, finalY + 15);
    
    doc.setFontSize(10);
    let yPos = finalY + 25;
    summary.forEach((item) => {
      doc.setTextColor(100, 100, 100);
      doc.text(item.label + ":", 14, yPos);
      doc.setTextColor(26, 26, 46);
      doc.text(item.value, 60, yPos);
      yPos += 8;
    });
  }
  
  doc.save(filename + "-" + new Date().toLocaleDateString() + ".pdf");
};
