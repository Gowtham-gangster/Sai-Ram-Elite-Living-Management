import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

  // Hostel Title
  const hostelTitle = data.hostelName || 'SAIRAM ELITE LIVING';
  page.drawText(hostelTitle, {
    x: 48,
    y: height - 68,
    size: 20,
    font: fontBold,
    color: primaryGold,
  });

  page.drawText('MANAGED HOSTEL & CO-LIVING RESIDENCES', {
    x: 48,
    y: height - 86,
    size: 9,
    font: fontBold,
    color: rgb(0.9, 0.9, 0.9),
  });

  const addressText = data.hostelAddress || 'Plot #42, ITPL Main Road, Whitefield, Bengaluru - 560066';
  page.drawText(addressText, {
    x: 48,
    y: height - 102,
    size: 8,
    font: fontRegular,
    color: rgb(0.65, 0.7, 0.78),
  });

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
  const dateFormatted = new Date(data.paymentDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

  // Verification & Stamp Area
  const stampY = height - 520;
  page.drawRectangle({
    x: 48,
    y: stampY,
    width: 220,
    height: 60,
    color: rgb(0.94, 0.98, 0.95),
    borderColor: emeraldGreen,
    borderWidth: 1,
  });

  page.drawText('VERIFIED PAYMENT CONFIRMATION', {
    x: 58,
    y: stampY + 42,
    size: 7,
    font: fontBold,
    color: emeraldGreen,
  });

  page.drawText('Digitally verified via Server-Side UPI Gateway', {
    x: 58,
    y: stampY + 28,
    size: 7,
    font: fontRegular,
    color: darkNavy,
  });

  page.drawText(`Timestamp: ${new Date().toISOString()}`, {
    x: 58,
    y: stampY + 14,
    size: 6,
    font: fontRegular,
    color: slateText,
  });

  // Signature line
  page.drawText('SAIRAM ELITE LIVING', {
    x: width - 180,
    y: stampY + 40,
    size: 9,
    font: fontBold,
    color: darkNavy,
  });

  page.drawText('Authorized Signatory', {
    x: width - 180,
    y: stampY + 25,
    size: 8,
    font: fontRegular,
    color: slateText,
  });

  // Important Terms & Notice
  const footerY = 80;
  page.drawLine({
    start: { x: 48, y: footerY + 30 },
    end: { x: width - 48, y: footerY + 30 },
    thickness: 0.5,
    color: borderGrey,
  });

  page.drawText('1. This is a computer-generated official receipt and requires no physical signature.', {
    x: 48,
    y: footerY + 14,
    size: 7,
    font: fontRegular,
    color: slateText,
  });

  page.drawText('2. Rent paid is strictly non-refundable and non-transferable under hostel management terms.', {
    x: 48,
    y: footerY + 4,
    size: 7,
    font: fontRegular,
    color: slateText,
  });

  page.drawText(`Contact: ${data.contactPhone || '+91 86885 35143'} | Email: contact@sairameliteliving.com`, {
    x: 48,
    y: footerY - 6,
    size: 7,
    font: fontBold,
    color: darkNavy,
  });

  return await pdfDoc.save();
}
