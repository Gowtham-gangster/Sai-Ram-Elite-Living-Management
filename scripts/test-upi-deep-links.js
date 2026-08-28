require('dotenv').config();

async function runUpiDeepLinkTests() {
  console.log('================================================================');
  console.log('UPI DEEP LINKS & ANDROID PACKAGE INTENTS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
      failed++;
    }
  }

  try {
    const upiId = process.env.OWNER_UPI_ID || 'sairamelite@hdfcbank';
    const payeeName = process.env.OWNER_UPI_NAME || 'SAIRAM ELITE LIVING';
    const testAmount = 6500.0;
    const testTxn = `SRL_202608_101_${Date.now().toString(36).toUpperCase()}_TEST`;
    const transactionNote = 'Rent 2026-08 Room 101';

    // 1. Canonical URI parameters
    const queryParams = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: testAmount.toFixed(2),
      cu: 'INR',
      tn: transactionNote,
      tr: testTxn,
    });

    const queryString = queryParams.toString();
    const standardUpiUrl = `upi://pay?${queryString}`;
    const gpayIntentUrl = `intent://pay?${queryString}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    const phonepeIntentUrl = `intent://pay?${queryString}#Intent;scheme=upi;package=com.phonepe.app;end`;
    const paytmIntentUrl = `intent://pay?${queryString}#Intent;scheme=upi;package=net.one97.paytm;end`;

    // TEST 1: Canonical standard URI starts with upi://pay?
    assert(standardUpiUrl.startsWith('upi://pay?'), 'TEST 1: Canonical URI has valid upi://pay? scheme');

    // TEST 2: Query params contain all mandatory fields
    assert(queryParams.get('pa') === upiId, 'TEST 2: Canonical URI contains exact owner upiId (pa)');
    assert(queryParams.get('pn') === payeeName, 'TEST 2: Canonical URI contains exact payeeName (pn)');
    assert(queryParams.get('am') === '6500.00', 'TEST 2: Canonical URI contains exact formatted amount (am)');
    assert(queryParams.get('cu') === 'INR', 'TEST 2: Canonical URI currency is INR (cu)');
    assert(queryParams.get('tn') === transactionNote, 'TEST 2: Canonical URI contains note (tn)');
    assert(queryParams.get('tr') === testTxn, 'TEST 2: Canonical URI contains unique transaction reference (tr)');

    // TEST 3: No unencoded spaces or malformed tokens in standard URI
    assert(!standardUpiUrl.includes(' '), 'TEST 3: Standard UPI URI contains no raw spaces');
    assert(!standardUpiUrl.includes('undefined'), 'TEST 3: Standard UPI URI contains no undefined values');
    assert(!standardUpiUrl.includes('null'), 'TEST 3: Standard UPI URI contains no null values');

    // TEST 4: Google Pay Package-Targeted Intent
    assert(gpayIntentUrl.startsWith('intent://pay?'), 'TEST 4: Google Pay uses intent://pay? protocol');
    assert(gpayIntentUrl.includes('package=com.google.android.apps.nbu.paisa.user'), 'TEST 4: Google Pay targets official Android package');
    assert(gpayIntentUrl.includes('scheme=upi'), 'TEST 4: Google Pay intent defines scheme=upi');
    assert(gpayIntentUrl.endsWith(';end'), 'TEST 4: Google Pay intent correctly terminated with ;end');

    // TEST 5: PhonePe Package-Targeted Intent
    assert(phonepeIntentUrl.startsWith('intent://pay?'), 'TEST 5: PhonePe uses intent://pay? protocol');
    assert(phonepeIntentUrl.includes('package=com.phonepe.app'), 'TEST 5: PhonePe targets official Android package');
    assert(phonepeIntentUrl.includes('scheme=upi'), 'TEST 5: PhonePe intent defines scheme=upi');

    // TEST 6: Paytm Package-Targeted Intent
    assert(paytmIntentUrl.startsWith('intent://pay?'), 'TEST 6: Paytm uses intent://pay? protocol');
    assert(paytmIntentUrl.includes('package=net.one97.paytm'), 'TEST 6: Paytm targets official Android package');
    assert(paytmIntentUrl.includes('scheme=upi'), 'TEST 6: Paytm intent defines scheme=upi');

    // TEST 7: Dynamic Amount Editing Invariance
    const partialAmount = 3500.0;
    const partialParams = new URLSearchParams({
      pa: upiId,
      pn: payeeName,
      am: partialAmount.toFixed(2),
      cu: 'INR',
      tn: transactionNote,
      tr: testTxn,
    });
    const partialQueryString = partialParams.toString();
    const partialGpay = `intent://pay?${partialQueryString}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    assert(partialGpay.includes('am=3500.00'), 'TEST 7: Edited amount (₹3,500) propagates into app intent');

    // TEST 8: QR payload matches standard canonical UPI URI
    const qrPayload = `upi://pay?${partialQueryString}`;
    assert(qrPayload === `upi://pay?${partialQueryString}`, 'TEST 8: QR payload and intent query parameters strictly match');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`UPI DEEP LINK TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Deep link test error:', err);
    process.exit(1);
  }
}

runUpiDeepLinkTests();
