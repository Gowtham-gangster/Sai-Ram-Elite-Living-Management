const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateSampleReceipt() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const primaryGold = rgb(0.96, 0.62, 0.04);
  const darkNavy = rgb(0.06, 0.09, 0.16);
  const slateText = rgb(0.2, 0.25, 0.33);
  const lightBg = rgb(0.96, 0.97, 0.98);
  const borderGrey = rgb(0.89, 0.91, 0.94);
  const emeraldGreen = rgb(0.06, 0.65, 0.42);

  // Embed logo
  let logoImage = null;
  const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    const bytes = fs.readFileSync(logoPath);
    logoImage = await pdfDoc.embedPng(bytes);
  }

  // Outer border
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

  const textStartX = logoImage ? 124 : 48;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: 44,
      y: height - 106,
      width: 68,
      height: 68,
    });
  }

  // Title
  page.drawText('SAIRAM ELITE LIVING', {
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

  const addressLine1 = 'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment';
  const addressLine2 = 'Gandi Maisamma, Hyderabad, Telangana – 500043';

  page.drawText(addressLine1, {
    x: textStartX,
    y: height - 87,
    size: 7,
    font: fontRegular,
    color: rgb(0.65, 0.7, 0.78),
  });

  page.drawText(addressLine2, {
    x: textStartX,
    y: height - 99,
    size: 7,
    font: fontRegular,
    color: rgb(0.65, 0.7, 0.78),
  });

  // Badge
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

  // Meta Grid
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

  page.drawText('RECEIPT NUMBER', { x: 64, y: metaY, size: 7, font: fontBold, color: slateText });
  page.drawText('REC-202608-88421', { x: 64, y: metaY - 14, size: 10, font: fontBold, color: darkNavy });

  page.drawText('DATE OF PAYMENT', { x: 230, y: metaY, size: 7, font: fontBold, color: slateText });
  page.drawText(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), { x: 230, y: metaY - 14, size: 10, font: fontBold, color: darkNavy });

  page.drawText('PAYMENT STATUS', { x: 420, y: metaY, size: 7, font: fontBold, color: slateText });
  page.drawText('VERIFIED & PAID', { x: 420, y: metaY - 14, size: 10, font: fontBold, color: emeraldGreen });

  // Resident Info
  const resY = metaY - 65;
  page.drawText('RESIDENT INFORMATION', { x: 48, y: resY, size: 9, font: fontBold, color: darkNavy });
  page.drawLine({ start: { x: 48, y: resY - 6 }, end: { x: width - 48, y: resY - 6 }, thickness: 1, color: primaryGold });

  page.drawText('Resident Name:', { x: 48, y: resY - 24, size: 8.5, font: fontRegular, color: slateText });
  page.drawText('P Gowtham', { x: 140, y: resY - 24, size: 9, font: fontBold, color: darkNavy });

  page.drawText('Room Number:', { x: 330, y: resY - 24, size: 8.5, font: fontRegular, color: slateText });
  page.drawText('Room 304 (Double Sharing)', { x: 420, y: resY - 24, size: 9, font: fontBold, color: darkNavy });

  page.drawText('Billing Month:', { x: 48, y: resY - 44, size: 8.5, font: fontRegular, color: slateText });
  page.drawText('August 2026', { x: 140, y: resY - 44, size: 9, font: fontBold, color: darkNavy });

  page.drawText('Payment Method:', { x: 330, y: resY - 44, size: 8.5, font: fontRegular, color: slateText });
  page.drawText('UPI (Verified Gateway)', { x: 420, y: resY - 44, size: 9, font: fontBold, color: darkNavy });

  page.drawText('Transaction Ref:', { x: 48, y: resY - 64, size: 8.5, font: fontRegular, color: slateText });
  page.drawText('SRL_202608_304_99A2B4C1', { x: 140, y: resY - 64, size: 8.5, font: fontBold, color: slateText });

  // Breakdown Table
  const tableY = resY - 100;
  page.drawText('PAYMENT BREAKDOWN', { x: 48, y: tableY, size: 9, font: fontBold, color: darkNavy });
  page.drawLine({ start: { x: 48, y: tableY - 6 }, end: { x: width - 48, y: tableY - 6 }, thickness: 1, color: primaryGold });

  page.drawRectangle({ x: 48, y: tableY - 30, width: width - 96, height: 20, color: darkNavy });
  page.drawText('DESCRIPTION', { x: 60, y: tableY - 23, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('PERIOD', { x: 300, y: tableY - 23, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT (INR)', { x: width - 140, y: tableY - 23, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });

  let rowY = tableY - 50;
  const items = [
    { desc: 'Room Rent (Double Sharing)', period: '01 Aug 2026 - 31 Aug 2026', amount: '8,000.00' },
    { desc: 'Maintenance & Amenities', period: 'August 2026', amount: '500.00' },
  ];

  items.forEach((item) => {
    page.drawText(item.desc, { x: 60, y: rowY, size: 8, font: fontRegular, color: darkNavy });
    page.drawText(item.period, { x: 300, y: rowY, size: 8, font: fontRegular, color: slateText });
    page.drawText(`Rs. ${item.amount}`, { x: width - 140, y: rowY, size: 8, font: fontBold, color: darkNavy });
    page.drawLine({ start: { x: 48, y: rowY - 8 }, end: { x: width - 48, y: rowY - 8 }, thickness: 0.5, color: borderGrey });
    rowY -= 26;
  });

  const totalBoxBottom = rowY - 25;
  page.drawRectangle({ x: width - 240, y: totalBoxBottom, width: 192, height: 32, color: darkNavy });
  page.drawText('TOTAL AMOUNT PAID:', { x: width - 230, y: totalBoxBottom + 11, size: 7.5, font: fontBold, color: primaryGold });
  page.drawText('Rs. 8,500.00', { x: width - 120, y: totalBoxBottom + 10, size: 11, font: fontBold, color: rgb(1, 1, 1) });

  // Verification & Digital Authorization Area (Safely below the Total box)
  const stampY = totalBoxBottom - 82;

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

  page.drawText('Ref: SRL_202608_304_99A2B4C1', {
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
    'Queries: +91 8977339133, 918688535143 | Email: sairameliteliving@gmail.com',
    {
      x: 58,
      y: footerY - 9,
      size: 6.8,
      font: fontRegular,
      color: darkNavy,
    }
  );

  const outDir = path.join(process.env.USERPROFILE, '.gemini', 'antigravity-ide', 'brain', '2e3ccd50-2838-4dd8-ae83-3e2addf0b8f5');
  const outPath = path.join(outDir, 'sample_receipt.pdf');
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, pdfBytes);
  console.log('Saved sample receipt to:', outPath);
}

generateSampleReceipt();
