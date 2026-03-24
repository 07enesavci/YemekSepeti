/**
 * Kritik endpoint'leri test eder. Kullanım:
 *   node test-endpoints.js                    -> http://localhost:3000
 *   node test-endpoints.js https://evlezzetleri.site
 */
const base = process.argv[2] || 'http://localhost:3000';

async function test(name, url) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const ok = res.ok;
    let body = '';
    try { body = await res.text(); } catch (_) {}
    const preview = body.length > 60 ? body.substring(0, 60) + '...' : body;
    console.log(ok ? '  OK' : '  FAIL', res.status, name);
    if (!ok) console.log('    ', preview);
    return ok;
  } catch (e) {
    console.log('  FAIL', name, e.message);
    return false;
  }
}

async function main() {
  console.log('Testing base:', base);
  console.log('');

  let all = true;
  all &= await test('GET /manifest.json', base + '/manifest.json');
  all &= await test('GET /sw.js', base + '/sw.js');
  const meRes = await fetch(base + '/api/auth/me', { redirect: 'manual' }).catch(() => null);
  const meOk = meRes && (meRes.ok || meRes.status === 401);
  console.log(meOk ? '  OK' : '  FAIL', meRes ? meRes.status : '?', 'GET /api/auth/me');
  all &= meOk;
  all &= await test('GET /api/sellers', base + '/api/sellers?limit=2');
  all &= await test('GET / (ana sayfa)', base + '/');

  console.log('');
  console.log(all ? 'Tum testler gecti.' : 'Bazi testler basarisiz.');
  process.exit(all ? 0 : 1);
}

main();
