'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Printer,
  Download,
  ArrowLeft,
  Receipt,
  CheckCircle2,
  Building,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  ShieldCheck,
  Globe,
  MapPin,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { formatSharingType } from '@/lib/formatters';

// Helper to convert number to Indian words
function numberToWordsINR(amount: number): string {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (amount === 0) return 'Zero Rupees Only';

  const numToWords = (n: number): string => {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + words[n % 10] : '');
    if (n < 1000) return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + numToWords(n % 10000000) : '');
  };

  return `${numToWords(Math.floor(amount))} Rupees Only`;
}

export default function SingleReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [receiptData, setReceiptData] = useState<any>(null);
  const [hostelSettings, setHostelSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchReceiptDetails();
  }, [id]);

  const fetchReceiptDetails = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/receipts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch receipt');
      setReceiptData(data.receipt);
      setHostelSettings(data.hostelSettings);
    } catch (err: any) {
      setError(err.message || 'Error loading receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div>
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading official receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 max-w-md">
          <Receipt className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Receipt Not Found</h2>
          <p className="text-xs text-slate-400 mt-1 mb-4">{error || 'No receipt found with the specified reference.'}</p>
          <Link
            href="/admin/receipts"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Receipts</span>
          </Link>
        </div>
      </div>
    );
  }

  const p = receiptData.monthlyPayment || {};
  const resident = p.resident || {};
  const room = p.room || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-8 px-4 sm:px-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/admin/receipts"
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Receipts</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Receipt</span>
          </button>
        </div>
      </div>

      {/* Official Printable Receipt Document */}
      <div className="max-w-3xl mx-auto bg-white text-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        <div className="p-8 sm:p-12 space-y-8">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-200 flex items-center justify-center p-1 shadow-md overflow-hidden shrink-0">
                <img src="/logo.png" alt="Hostel Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1.5">
                  Official Payment Receipt
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  {hostelSettings?.hostelName || 'SAIRAM ELITE LIVING'}
                </h1>
                <p className="text-[11px] font-bold text-amber-600 tracking-wide uppercase">
                  PG & Boys Hostel
                </p>
                <p className="text-xs text-slate-600 max-w-md mt-1 leading-relaxed">
                  {hostelSettings?.hostelAddress ||
                    'Plot No. 57, Near Pragati Model High School, Beside Vibhu Park Apartment, Gandi Maisamma, Hyderabad, Telangana – 500043'}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-2">
                  <span>Phone: <strong>{hostelSettings?.contactPhone || '+91 8977339133, 918688535143'}</strong></span>
                  <span>•</span>
                  <span>Email: <strong>{hostelSettings?.contactEmail || 'sairameliteliving@gmail.com'}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs border border-emerald-300">
                <Check className="w-3.5 h-3.5" />
                <span>PAID & VERIFIED</span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Receipt Number</span>
                <span className="font-mono font-black text-base text-slate-950">
                  {receiptData.receiptNumber}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Date: <strong>{new Date(receiptData.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </div>
            </div>
          </div>

          {/* Resident & Accommodation Info Grid */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
                Issued To (Resident):
              </span>
              <span className="text-base font-black text-slate-900 block mt-0.5">
                {receiptData.residentName}
              </span>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                <div>Phone: <strong>{resident.phone || 'N/A'}</strong></div>
                {resident.alternatePhone && <div>Alt Phone: {resident.alternatePhone}</div>}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
                Room Allocation:
              </span>
              <span className="font-mono font-black text-lg text-amber-600 block mt-0.5">
                Room {receiptData.roomNumber}
              </span>
              <div className="text-xs text-slate-600 mt-1">
                <div>Floor: <strong>{room.floor || 1}</strong></div>
                <div>Sharing: <strong>{room.sharingType ? formatSharingType(room.sharingType) : 'Standard'}</strong></div>
              </div>
            </div>
          </div>

          {/* Payment & Transaction Particulars */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Particulars</th>
                  <th className="py-3 px-4">Billing Month</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                <tr>
                  <td className="py-4 px-4">
                    <strong className="text-slate-950 block text-sm">
                      Hostel Monthly Room Rent & Accommodation
                    </strong>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Includes accommodation, water, high-speed Wi-Fi, and standard utilities.
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900">{receiptData.billingMonth}</td>
                  <td className="py-4 px-4">
                    <span className="font-bold">{receiptData.paymentMethod}</span>
                    {p.transactionReference && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Ref: {p.transactionReference}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right font-black text-slate-950 text-base">
                    ₹{receiptData.amountPaid.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-900 text-slate-950 font-black">
                <tr>
                  <td colSpan={3} className="py-4 px-4 text-right uppercase text-xs">
                    Total Amount Received:
                  </td>
                  <td className="py-4 px-4 text-right text-lg text-slate-950">
                    ₹{receiptData.amountPaid.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Amount in Words:</span>
              <span className="font-bold text-slate-900 text-xs mt-0.5 block italic">
                {numberToWordsINR(receiptData.amountPaid)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Status:</span>
              <span className="font-bold text-emerald-700 text-xs">Fully Settled</span>
            </div>
          </div>

          {/* Terms & Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-[11px] text-slate-500">
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">
                Terms & Conditions:
              </h4>
              <p className="leading-relaxed">
                1. This receipt is an official acknowledgment of payment received.<br />
                2. Payments once made are non-refundable except refundable security deposit.<br />
                3. Historical records are maintained electronically.
              </p>
            </div>

            <div className="text-right flex flex-col justify-between items-end">
              <div className="h-12 w-32 border-b border-slate-400 mb-1 flex items-end justify-center text-slate-400 text-[10px] italic">
                Authorized Signatory
              </div>
              <div>
                <strong className="text-slate-900 block">{receiptData.generatedBy || 'Hostel Administrator'}</strong>
                <span className="text-[10px] text-slate-500">SAIRAM ELITE LIVING</span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
            This is a computer-generated official payment receipt. No physical signature is required.
          </div>
        </div>
      </div>
    </div>
  );
}
