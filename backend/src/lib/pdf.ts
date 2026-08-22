import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";

export async function generatePayslipPdf(
  payslipId: string,
  data: {
    companyName: string;
    employeeName: string;
    employeeCode: string | null;
    month: number;
    year: number;
    payableDays: string;
    totalWorkingDays: number;
    lossOfPay: string;
    grossEarnings: string;
    totalDeductions: string;
    netPay: string;
    lines: { label: string; amount: string; category: string }[];
  },
): Promise<string> {
  const monthName = format(new Date(data.year, data.month - 1, 1), "MMMM");
  const filename = `payslip-${payslipId}-${Date.now()}.pdf`;
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  const pdfsDir = path.join(uploadDir, "payslips");

  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }

  const filePath = path.join(pdfsDir, filename);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // --- Header ---
      doc.fontSize(20).font("Helvetica-Bold").text(data.companyName, { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`Payslip for ${monthName} ${data.year}`, { align: "center" });
      doc.moveDown(2);

      // --- Employee Info ---
      doc.fontSize(10).font("Helvetica-Bold").text("Employee Name:", 50, 150);
      doc.font("Helvetica").text(data.employeeName, 150, 150);

      doc.font("Helvetica-Bold").text("Employee Code:", 300, 150);
      doc.font("Helvetica").text(data.employeeCode || "N/A", 400, 150);

      doc.font("Helvetica-Bold").text("Total Working Days:", 50, 170);
      doc.font("Helvetica").text(data.totalWorkingDays.toString(), 160, 170);

      doc.font("Helvetica-Bold").text("Payable Days:", 300, 170);
      doc.font("Helvetica").text(data.payableDays, 400, 170);

      doc.font("Helvetica-Bold").text("Loss of Pay:", 50, 190);
      doc.font("Helvetica").text(`₹${data.lossOfPay}`, 120, 190);

      doc.moveDown(3);

      // --- Tables ---
      const tableTop = 240;
      const col1X = 50;
      const col2X = 250;
      const col3X = 350;
      const col4X = 450;

      // Table headers
      doc.font("Helvetica-Bold");
      doc.text("Earnings", col1X, tableTop);
      doc.text("Amount (₹)", col2X, tableTop, { align: "right", width: 80 });
      doc.text("Deductions", col3X, tableTop);
      doc.text("Amount (₹)", col4X, tableTop, { align: "right", width: 80 });

      // Draw a line under headers
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      let currentY = tableTop + 25;
      doc.font("Helvetica");

      const earnings = data.lines.filter((l) => l.category === "EARNING");
      const deductions = data.lines.filter((l) => l.category !== "EARNING"); // Employee deductions

      const maxRows = Math.max(earnings.length, deductions.length);

      for (let i = 0; i < maxRows; i++) {
        const earn = earnings[i];
        const ded = deductions[i];

        if (earn) {
          doc.text(earn.label, col1X, currentY);
          doc.text(earn.amount, col2X, currentY, { align: "right", width: 80 });
        }

        if (ded) {
          doc.text(ded.label, col3X, currentY);
          doc.text(ded.amount, col4X, currentY, { align: "right", width: 80 });
        }

        currentY += 20;
      }

      // Draw a line before totals
      doc
        .moveTo(50, currentY + 5)
        .lineTo(550, currentY + 5)
        .stroke();
      currentY += 15;

      // Totals
      doc.font("Helvetica-Bold");
      doc.text("Gross Earnings:", col1X, currentY);
      doc.text(data.grossEarnings, col2X, currentY, { align: "right", width: 80 });

      doc.text("Total Deductions:", col3X, currentY);
      doc.text(data.totalDeductions, col4X, currentY, { align: "right", width: 80 });

      currentY += 30;

      // Net Pay
      doc.fontSize(12);
      doc.text("Net Pay:", 350, currentY);
      doc.text(`₹${data.netPay}`, 450, currentY, { align: "right", width: 80 });

      // --- Footer ---
      doc
        .fontSize(8)
        .font("Helvetica")
        .text("This is a computer-generated document. No signature is required.", 50, 700, {
          align: "center",
          width: 500,
        });

      doc.end();

      writeStream.on("finish", () => {
        resolve(`/uploads/payslips/${filename}`);
      });
      writeStream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
