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

  // Optional: Set a light grey background for the whole page to avoid "fully white bright"
  const setPageBackground = (docRef: jsPDF) => {
    docRef.setFillColor(241, 245, 249); // slate-100 (light grey)
    docRef.rect(0, 0, docRef.internal.pageSize.getWidth(), docRef.internal.pageSize.getHeight(), 'F');
  };
  setPageBackground(doc);

  // Title
  doc.setFontSize(18);
  doc.setTextColor(30, 52, 100); // Navy blue
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
      fillColor: [30, 52, 100], // Navy blue
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [226, 232, 240], // slate-200 (grey)
    },
    styles: {
      fillColor: [241, 245, 249], // slate-100 (light grey)
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
    },
    columnStyles: {},
    margin: { left: 30, right: 30 },
  });
  
  // Summary section if provided
  if (summary && summary.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 30;
    const marginRight = 30;

    // Check if we need a new page for the summary
    if (finalY + 40 + summary.length * 22 > pageHeight - 40) {
      doc.addPage();
      setPageBackground(doc);
      // Draw summary at top of new page
      drawSummaryBlock(doc, summary, 40, marginLeft, marginRight, pageWidth, pageHeight, setPageBackground);
    } else {
      drawSummaryBlock(doc, summary, finalY, marginLeft, marginRight, pageWidth, pageHeight, setPageBackground);
    }
  }
  
  doc.save(makeSafeFilename(filename) + ".pdf");
};

function drawSummaryBlock(
  doc: jsPDF,
  summary: { label: string; value: string }[],
  startAfterY: number,
  marginLeft: number,
  marginRight: number,
  pageWidth: number,
  pageHeight: number,
  setPageBackground: (doc: jsPDF) => void
) {
  const separatorY = startAfterY + 15;

  // Draw separator line
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.75);
  doc.line(marginLeft, separatorY, pageWidth - marginRight, separatorY);

  // Summary heading
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 52, 100); // Navy blue
  doc.text("Summary", marginLeft, separatorY + 20);

  // Draw each summary row with clear spacing
  const labelX = marginLeft;
  const valueX = marginLeft + 160;
  const rowGap = 10;
  let yPos = separatorY + 35;
  const rowHeight = 18;

  summary.forEach((item) => {
    // handle page break
    if (yPos + rowHeight > pageHeight - 40) {
      doc.addPage();
      setPageBackground(doc);
      yPos = 40;
    }

    // label (left side)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(item.label + ":", labelX, yPos);

    // value (right side, with text wrapping)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const availableWidth = Math.max(pageWidth - valueX - marginRight, 120);
    const wrapped = doc.splitTextToSize(String(item.value), availableWidth);
    doc.text(wrapped, valueX, yPos);

    // advance y by wrapped lines count, with generous spacing
    const wrappedLines = Array.isArray(wrapped) ? wrapped.length : 1;
    yPos += Math.max(rowHeight, wrappedLines * 14) + rowGap;
  });
}

export const downloadPayslipsPDF = (
  employees: any[],
  transactions: any[],
  month: number,
  year: number
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const period = `${monthNames[month]} ${year}`;

  const validEmployees = employees.filter(emp => emp.hasMonthRecord);
  
  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 52, 100);
  doc.text("Al shams Al ghayaba trd est", 40, 50);

  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text(`Monthly Payroll Report - ${period}`, 40, 70);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 85);

  if (validEmployees.length === 0) {
    doc.setFontSize(12);
    doc.text("No salary records found for this period.", 40, 120);
    doc.save(makeSafeFilename(`Monthly-Report-${period}`) + ".pdf");
    return;
  }

  // Summary Table
  const tableData = validEmployees.map((emp, i) => {
    // Total Advances (Employee Owes)
    const empTransactions = transactions?.filter((t: any) => t.employee_id === emp.id && t.salary_month_id === emp.thisMonthRecordId) || [];
    const advances = empTransactions.filter((t: any) => t.type === 'advance').reduce((sum: number, t: any) => sum + t.amount, 0);
    const payments = empTransactions.filter((t: any) => t.type === 'payment').reduce((sum: number, t: any) => sum + t.amount, 0);
    
    const balance = emp.base_salary_sar - advances + payments;

    return [
      (i + 1).toString(),
      emp.name,
      emp.job_title || "-",
      formatSAR(emp.base_salary_sar),
      formatSAR(advances),
      formatSAR(balance)
    ];
  });

  autoTable(doc, {
    startY: 110,
    theme: "grid",
    head: [["#", "Employee Name", "Job Title", "Base Salary", "Total Deductions", "Net Payable"]],
    body: tableData,
    headStyles: { fillColor: [30, 52, 100], textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 
      0: { cellWidth: 30 },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right", textColor: [220, 38, 38] },
      5: { halign: "right", fontStyle: "bold", textColor: [15, 118, 110] }
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(makeSafeFilename(`Monthly-Report-${monthNames[month]}-${year}`) + ".pdf");
};
