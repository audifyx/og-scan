/**
 * KOL Tracker API Tests
 * Tests API endpoints for bot verification and alert sending
 */

// Test data
const VALID_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'; // Fake for testing
const INVALID_BOT_TOKEN = 'invalid-token';
const VALID_WALLET = '9w8Q2kL9m5P7R2L9m5P7R2L9m5P7R2L9m5P7R2';
const INVALID_WALLET = 'short';

/**
 * Test kol-tracker-verify endpoint
 */
export async function testVerifyEndpoint() {
  console.log('[TEST] Testing kol-tracker-verify endpoint...');

  // Test 1: Invalid token format
  try {
    const res = await fetch('/api/kol-tracker-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: INVALID_BOT_TOKEN }),
    });
    const data = await res.json();
    console.log('[TEST] Invalid token format:', data.error === 'Invalid token format' ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing invalid format:', error);
  }

  // Test 2: Missing token
  try {
    const res = await fetch('/api/kol-tracker-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    console.log('[TEST] Missing token:', data.error === 'Bot token is required' ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing missing token:', error);
  }

  // Test 3: Method not allowed
  try {
    const res = await fetch('/api/kol-tracker-verify', { method: 'GET' });
    console.log('[TEST] Method not allowed:', res.status === 405 ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing method:', error);
  }
}

/**
 * Test kol-tracker-send-alert endpoint
 */
export async function testSendAlertEndpoint() {
  console.log('[TEST] Testing kol-tracker-send-alert endpoint...');

  // Test 1: Missing required fields
  try {
    const res = await fetch('/api/kol-tracker-send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: VALID_BOT_TOKEN }),
    });
    const data = await res.json();
    console.log('[TEST] Missing fields:', data.error === 'Missing required fields' ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing missing fields:', error);
  }

  // Test 2: Valid payload structure
  try {
    const payload = {
      botToken: VALID_BOT_TOKEN,
      chatId: '12345678',
      kolName: 'Test KOL',
      wallet: VALID_WALLET,
      txType: 'buy',
      tokenSymbol: 'SOL',
      amount: 100,
      price: 145.5,
    };

    const res = await fetch('/api/kol-tracker-send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[TEST] Valid payload accepted:', res.status >= 200 && res.status < 300 ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing valid payload:', error);
  }
}

/**
 * Test kol-tracker-monitor endpoint
 */
export async function testMonitorEndpoint() {
  console.log('[TEST] Testing kol-tracker-monitor endpoint...');

  // Test 1: Missing wallet info
  try {
    const res = await fetch('/api/kol-tracker-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    console.log('[TEST] Missing wallet:', data.error === 'No wallets to monitor' ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing missing wallet:', error);
  }

  // Test 2: Valid single wallet
  try {
    const res = await fetch('/api/kol-tracker-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: VALID_WALLET }),
    });
    console.log('[TEST] Valid wallet accepted:', res.status >= 200 && res.status < 300 ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing valid wallet:', error);
  }

  // Test 3: Track all KOLs mode
  try {
    const res = await fetch('/api/kol-tracker-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackAllKols: true, trackedWallets: [VALID_WALLET] }),
    });
    console.log('[TEST] Track all mode:', res.status >= 200 && res.status < 300 ? '✓ PASS' : '✗ FAIL');
  } catch (error) {
    console.error('[TEST] Error testing track all:', error);
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('\n========== KOL TRACKER API TESTS ==========\n');

  await testVerifyEndpoint();
  console.log('');
  await testSendAlertEndpoint();
  console.log('');
  await testMonitorEndpoint();

  console.log('\n========== TESTS COMPLETE ==========\n');
}

// Run tests if this is executed directly
if (typeof window === 'undefined') {
  runAllTests().catch(console.error);
}
