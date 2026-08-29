import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { formatDate } from '@/lib/dateUtils';

export interface ReceiptPdfData {
  receiptNumber: string;
  residentName: string;
  roomNumber: string;
  billingMonth: string;
  amountPaid: number;
  totalAmountDue?: number;
  balanceRemaining?: number;
  paymentDate: Date;
  paymentMethod: string;
  transactionReference?: string | null;
  hostelName?: string;
  hostelAddress?: string;
  contactPhone?: string;
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 Size: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Palette colors
  const primaryGold = rgb(0.96, 0.62, 0.04); // #F59E0B
  const darkNavy = rgb(0.06, 0.09, 0.16); // #0F172A
  const slateText = rgb(0.2, 0.25, 0.33); // #334155
  const lightBg = rgb(0.96, 0.97, 0.98); // #F8FAFC
  const borderGrey = rgb(0.89, 0.91, 0.94); // #E2E8F0
  const emeraldGreen = rgb(0.06, 0.65, 0.42); // #10B981

  // Load and embed hostel logo if available
  let logoImage: any = null;
  try {
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'logo.png'),
      path.join(process.cwd(), 'Hostel logo.png'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const bytes = fs.readFileSync(p);
        logoImage = await pdfDoc.embedPng(bytes);
        break;
      }
    }
  } catch (err) {
    console.warn('Could not embed logo image in receipt PDF:', err);
  }

  // Outer decorative border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderWidth: 1.5,
    borderColor: borderGrey,
    color: rgb(1, 1, 1),
  });

  // Top Header Banner
  page.drawRectangle({
    x: 24,
    y: height - 120,
    width: width - 48,
    height: 96,
    color: darkNavy,
  });

  // Draw logo image in header if loaded
  const textStartX = logoImage ? 124 : 48;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: 44,
      y: height - 106,
      width: 68,
      height: 68,
    });
  }

  // Hostel Title
  const hostelTitle = data.hostelName || 'SAIRAM ELITE LIVING';
  page.drawText(hostelTitle, {
    x: textStartX,
    y: height - 58,
    size: 17,
    font: fontBold,
    color: primaryGold,
  });

  page.drawText('PG & Boys Hostel', {
    x: textStartX,
    y: height - 73,
    size: 9.5,
    font: fontBold,
    color: rgb(0.9, 0.9, 0.9),
  });

  const addressText =
    data.hostelAddress ||
    'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment, Gandi Maisamma, Hyderabad, Telangana – 500043';

  if (addressText.includes('Gandi Maisamma')) {
    const parts = addressText.split('Gandi Maisamma');
    const line1 = (parts[0] || '').replace(/,\s*$/, '');
    const line2 = 'Gandi Maisamma' + (parts[1] || '');
    page.drawText(line1, {
      x: textStartX,
      y: height - 87,
      size: 7,
      font: fontRegular,
      color: rgb(0.65, 0.7, 0.78),
    });
    page.drawText(line2, {
      x: textStartX,
      y: height - 99,
      size: 7,
      font: fontRegular,
      color: rgb(0.65, 0.7, 0.78),
    });
  } else {
    page.drawText(addressText, {
      x: textStartX,
      y: height - 90,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.65, 0.7, 0.78),
    });
  }

  // RECEIPT BADGE (Top Right)
  page.drawRectangle({
    x: width - 190,
    y: height - 90,
    width: 142,
    height: 38,
    color: primaryGold,
  });

  page.drawText('RENT PAYMENT RECEIPT', {
    x: width - 180,
    y: height - 76,
    size: 9,
    font: fontBold,
    color: darkNavy,
  });

  // Receipt Meta Grid
  const metaY = height - 155;
  page.drawRectangle({
    x: 48,
    y: metaY - 35,
    width: width - 96,
    height: 48,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  // Receipt Number
  page.drawText('RECEIPT NUMBER', { x: 64, y: metaY, size: 8, font: fontBold, color: slateText });
  page.drawText(data.receiptNumber, { x: 64, y: metaY - 16, size: 11, font: fontBold, color: darkNavy });

  // Payment Date
  const dateFormatted = formatDate(data.paymentDate);
  page.drawText('PAYMENT DATE', { x: 230, y: metaY, size: 8, font: fontBold, color: slateText });
  page.drawText(dateFormatted, { x: 230, y: metaY - 16, size: 10, font: fontBold, color: darkNavy });

  // Status Badge
  const isPartial = (data.balanceRemaining ?? 0) > 0.01;
  const statusLabel = isPartial ? 'PARTIALLY PAID' : 'PAID & VERIFIED';
  const statusColor = isPartial ? primaryGold : emeraldGreen;

  page.drawText('STATUS', { x: 420, y: metaY, size: 8, font: fontBold, color: slateText });
  page.drawText(statusLabel, { x: 420, y: metaY - 16, size: 10, font: fontBold, color: statusColor });

  // Resident Information Box
  const residentBoxY = height - 260;
  page.drawText('RESIDENT & ROOM DETAILS', {
    x: 48,
    y: residentBoxY + 36,
    size: 11,
    font: fontBold,
    color: darkNavy,
  });

  page.drawRectangle({
    x: 48,
    y: residentBoxY - 45,
    width: width - 96,
    height: 70,
    borderColor: borderGrey,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  page.drawText('Resident Name:', { x: 64, y: residentBoxY + 8, size: 9, font: fontBold, color: slateText });
  page.drawText(data.residentName, { x: 170, y: residentBoxY + 8, size: 10, font: fontBold, color: darkNavy });

  page.drawText('Assigned Room:', { x: 64, y: residentBoxY - 12, size: 9, font: fontBold, color: slateText });
  page.drawText(`Room ${data.roomNumber}`, { x: 170, y: residentBoxY - 12, size: 10, font: fontBold, color: darkNavy });

  page.drawText('Billing Month:', { x: 320, y: residentBoxY + 8, size: 9, font: fontBold, color: slateText });
  page.drawText(data.billingMonth, { x: 410, y: residentBoxY + 8, size: 10, font: fontBold, color: primaryGold });

  page.drawText('Payment Mode:', { x: 320, y: residentBoxY - 12, size: 9, font: fontBold, color: slateText });
  page.drawText(data.paymentMethod || 'UPI Intent', { x: 410, y: residentBoxY - 12, size: 10, font: fontBold, color: darkNavy });

  if (data.transactionReference) {
    page.drawText('Reference / UTR:', { x: 64, y: residentBoxY - 32, size: 8, font: fontBold, color: slateText });
    page.drawText(data.transactionReference, { x: 170, y: residentBoxY - 32, size: 8, font: fontRegular, color: slateText });
  }

  // Breakdown Table
  const tableY = height - 370;
  page.drawText('PAYMENT BREAKDOWN', {
    x: 48,
    y: tableY + 36,
    size: 11,
    font: fontBold,
    color: darkNavy,
  });

  // Table Header
  page.drawRectangle({
    x: 48,
    y: tableY,
    width: width - 96,
    height: 24,
    color: darkNavy,
  });

  page.drawText('DESCRIPTION', { x: 64, y: tableY + 7, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT (INR)', { x: width - 150, y: tableY + 7, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  // Table Row 1: Monthly Rent
  page.drawRectangle({
    x: 48,
    y: tableY - 30,
    width: width - 96,
    height: 30,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  const rowDesc = isPartial
    ? `Rent Installment Received (${data.billingMonth})`
    : `Monthly Rent Accommodation (${data.billingMonth})`;

  page.drawText(rowDesc, {
    x: 64,
    y: tableY - 18,
    size: 9,
    font: fontRegular,
    color: darkNavy,
  });

  const amountStr = `Rs. ${data.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  page.drawText(amountStr, {
    x: width - 150,
    y: tableY - 18,
    size: 9,
    font: fontBold,
    color: darkNavy,
  });

  // If partial, add remaining balance row
  let nextRowY = tableY - 65;
  if (isPartial && data.balanceRemaining) {
    page.drawRectangle({
      x: 48,
      y: tableY - 60,
      width: width - 96,
      height: 30,
      color: rgb(1, 1, 1),
      borderColor: borderGrey,
      borderWidth: 1,
    });

    page.drawText('Outstanding Balance Remaining', {
      x: 64,
      y: tableY - 48,
      size: 9,
      font: fontRegular,
      color: slateText,
    });

    const balanceStr = `Rs. ${data.balanceRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    page.drawText(balanceStr, {
      x: width - 150,
      y: tableY - 48,
      size: 9,
      font: fontBold,
      color: primaryGold,
    });

    nextRowY = tableY - 95;
  }

  // Table Total Row
  page.drawRectangle({
    x: 48,
    y: nextRowY,
    width: width - 96,
    height: 35,
    color: darkNavy,
  });

  page.drawText('TOTAL AMOUNT PAID', {
    x: 64,
    y: nextRowY + 14,
    size: 10,
    font: fontBold,
    color: primaryGold,
  });

  page.drawText(amountStr, {
    x: width - 150,
    y: nextRowY + 14,
    size: 11,
    font: fontBold,
    color: primaryGold,
  });

  // Verification & Digital Authorization Area (Positioned safely below total amount row)
  const stampY = nextRowY - 82;

  // Left Verification Box
  page.drawRectangle({
    x: 48,
    y: stampY,
    width: 235,
    height: 64,
    color: rgb(0.94, 0.98, 0.95),
    borderColor: emeraldGreen,
    borderWidth: 1,
  });

  page.drawText('VERIFIED DIGITAL PAYMENT', {
    x: 58,
    y: stampY + 46,
    size: 8,
    font: fontBold,
    color: emeraldGreen,
  });

  page.drawText('Digitally authenticated via Server Gateway', {
    x: 58,
    y: stampY + 32,
    size: 7,
    font: fontRegular,
    color: darkNavy,
  });

  page.drawText(`Ref: ${data.transactionReference || 'SRL_AUTHTXN'}`, {
    x: 58,
    y: stampY + 20,
    size: 6.5,
    font: fontRegular,
    color: slateText,
  });

  page.drawText(`Timestamp: ${new Date().toISOString()}`, {
    x: 58,
    y: stampY + 9,
    size: 6,
    font: fontRegular,
    color: slateText,
  });

  // Right Authorization Badge
  page.drawRectangle({
    x: width - 268,
    y: stampY,
    width: 220,
    height: 64,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  page.drawText('ELECTRONIC AUTHORIZATION', {
    x: width - 256,
    y: stampY + 46,
    size: 7.5,
    font: fontBold,
    color: darkNavy,
  });

  page.drawText('SAIRAM ELITE LIVING MANAGEMENT', {
    x: width - 256,
    y: stampY + 30,
    size: 8,
    font: fontBold,
    color: primaryGold,
  });

  page.drawText('Hostel Operations & Administration', {
    x: width - 256,
    y: stampY + 16,
    size: 7,
    font: fontRegular,
    color: slateText,
  });

  page.drawText('Official Verified Digital Document', {
    x: width - 256,
    y: stampY + 5,
    size: 6.5,
    font: fontRegular,
    color: slateText,
  });

  // Bottom Disclaimer & Terms Container
  const footerY = Math.max(50, stampY - 72);
  page.drawRectangle({
    x: 48,
    y: footerY - 14,
    width: width - 96,
    height: 52,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  page.drawText('DISCLAIMER & SYSTEM NOTICE:', {
    x: 58,
    y: footerY + 24,
    size: 7.5,
    font: fontBold,
    color: darkNavy,
  });

  page.drawText(
    'This is a computer/system auto-generated digital receipt and requires NO physical signature or official stamp.',
    {
      x: 58,
      y: footerY + 12,
      size: 7.2,
      font: fontBold,
      color: primaryGold,
    }
  );

  page.drawText(
    'All transaction records are electronically verified and stored permanently in the hostel management records.',
    {
      x: 58,
      y: footerY + 1,
      size: 6.8,
      font: fontRegular,
      color: slateText,
    }
  );

  page.drawText(
    `Queries: ${data.contactPhone || '+91 8977339133, 918688535143'} | Email: contact@sairameliteliving.com`,
    {
      x: 58,
      y: footerY - 9,
      size: 6.8,
      font: fontRegular,
      color: darkNavy,
    }
  );

  return await pdfDoc.save();
}
