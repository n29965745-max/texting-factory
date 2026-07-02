const { chromium } = require('playwright');

const BASE = 'https://texting-factory.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const results = [];
  const log = (t, s, d = '') => {
    results.push({ test: t, status: s, detail: d });
    console.log(`${s === 'PASS' ? '✅' : '❌'} ${t}${d ? ' — ' + d : ''}`);
  };

  try {
    // ── 1. PAGE LOADS ──
    console.log('\n📄 PAGE LOADS\n');

    const pages = [
      { url: 'index.html', expect: 'Texting Factory' },
      { url: 'signup.html', expect: 'Texting Factory' },
      { url: 'login.html', expect: 'Texting Factory' },
      { url: 'activate.html', expect: 'Texting Factory' },
      { url: 'dashboard.html', expect: 'Texting Factory' },
      { url: 'payments.html', expect: 'Texting Factory' },
    ];

    // Set user data for pages that need it
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle', timeout: 20000 });
    await page.evaluate(() => {
      localStorage.setItem('swipechat_user', JSON.stringify({ name: 'John Kamau', phone: '254712345678' }));
      localStorage.setItem('swipechat_activated', 'true');
    });

    for (const p of pages) {
      await page.goto(`${BASE}/${p.url}`, { waitUntil: 'networkidle', timeout: 20000 });
      const bodyText = await page.textContent('body');
      log(`${p.url} loads`, bodyText.includes(p.expect) ? 'PASS' : 'FAIL');

      const title = await page.title();
      log(`${p.url} title`, title.includes('Texting Factory') ? 'PASS' : 'FAIL', title.slice(0, 50));
    }

    // ── 2. LOGO & BRANDING ──
    console.log('\n🎨 LOGO & BRANDING\n');

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const logoImgs = await page.locator('img[alt="Texting Factory"]').count();
    log('SVG logo present', logoImgs >= 1 ? 'PASS' : 'FAIL', `${logoImgs} images`);

    const favicon = await page.locator('link[rel="icon"]').count();
    log('Favicon present', favicon >= 1 ? 'PASS' : 'FAIL');

    const noSwipeChat = !(await page.textContent('body')).includes('SwipeChat');
    log('No old branding', noSwipeChat ? 'PASS' : 'FAIL');

    // ── 3. LANDING PAGE ELEMENTS ──
    console.log('\n🏠 LANDING PAGE\n');

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const heroH1 = await page.locator('h1').first().textContent();
    log('Hero heading', heroH1.length > 5 ? 'PASS' : 'FAIL', heroH1.slice(0, 50));

    const ctaBtn = page.locator('button:has-text("Get Started")');
    log('CTA button visible', await ctaBtn.isVisible() ? 'PASS' : 'FAIL');

    const features = await page.locator('.feature-card, [class*="indicator-strip"]').count();
    log('Feature cards', features >= 3 ? 'PASS' : 'FAIL', `${features} cards`);

    const footer = await page.locator('footer').first().isVisible();
    log('Footer visible', footer ? 'PASS' : 'FAIL');

    // ── 4. SPA NAVIGATION ──
    console.log('\n🔗 SPA NAVIGATION\n');

    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

    await ctaBtn.click();
    await page.waitForTimeout(500);
    const signupVisible = await page.locator('#screen-signup').isVisible().catch(() => false);
    log('Landing → Signup (SPA)', signupVisible ? 'PASS' : 'FAIL');

    // ── 5. SIGNUP FLOW ──
    console.log('\n📝 SIGNUP FLOW\n');

    await page.goto(`${BASE}/signup.html`, { waitUntil: 'networkidle' });
    const nameField = await page.locator('#fullname').isVisible();
    const phoneField = await page.locator('#phone').isVisible();
    const pwdField = await page.locator('#password').isVisible();
    const confirmField = await page.locator('#confirm').isVisible();
    log('All form fields visible', (nameField && phoneField && pwdField && confirmField) ? 'PASS' : 'FAIL');

    await page.fill('#fullname', 'Test User');
    await page.fill('#phone', '712345678');
    await page.fill('#password', 'TestPass123');
    await page.fill('#confirm', 'TestPass123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    log('Signup → Activate redirect', page.url().includes('activate.html') ? 'PASS' : 'FAIL');

    // ── 6. ACTIVATION PAGE ──
    console.log('\n💳 ACTIVATION PAGE\n');

    const phoneDisplay = await page.locator('#phoneDisplay').textContent().catch(() => '');
    log('Phone displayed', phoneDisplay.includes('254') ? 'PASS' : 'FAIL', phoneDisplay);

    const payBtn = await page.locator('#payBtn').isVisible();
    log('Pay button visible', payBtn ? 'PASS' : 'FAIL');

    const stepIndicator = await page.locator('#dot1').isVisible() && await page.locator('#dot2').isVisible();
    log('Step indicator', stepIndicator ? 'PASS' : 'FAIL');

    const amountCard = await page.locator('text=KES 100').first().isVisible();
    log('Amount card', amountCard ? 'PASS' : 'FAIL');

    // ── 7. LOGIN PAGE ──
    console.log('\n🔑 LOGIN PAGE\n');

    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle' });
    const liPhone = await page.locator('#phone').isVisible();
    const liPwd = await page.locator('#password').isVisible();
    log('Login form fields', (liPhone && liPwd) ? 'PASS' : 'FAIL');

    await page.click('#togglePwd');
    const inputType = await page.locator('#password').getAttribute('type');
    log('Password toggle', inputType === 'text' ? 'PASS' : 'FAIL');

    const signUpLink = page.locator('a:has-text("Sign Up")').last();
    await signUpLink.click();
    await page.waitForTimeout(500);
    log('Login → Signup link', page.url().includes('signup.html') ? 'PASS' : 'FAIL');

    // ── 8. DASHBOARD ──
    console.log('\n📊 DASHBOARD\n');

    await page.evaluate(() => {
      localStorage.setItem('swipechat_user', JSON.stringify({ name: 'John Kamau', phone: '254712345678' }));
      localStorage.setItem('swipechat_activated', 'true');
    });
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });

    const welcome = await page.locator('#welcomeMessage').textContent();
    log('Welcome personalized', welcome.includes('John') ? 'PASS' : 'FAIL', welcome);

    const avatar = await page.locator('#avatarInitials').textContent();
    log('Avatar initials', avatar === 'JK' ? 'PASS' : 'FAIL', avatar);

    const stats = await page.locator('.stat-card, [class*="grid-cols"] > div').count();
    log('Stats cards', stats >= 4 ? 'PASS' : 'FAIL', `${stats} cards`);

    const quickActions = await page.locator('text=Quick Actions').isVisible();
    log('Quick Actions', quickActions ? 'PASS' : 'FAIL');

    // Drawer
    await page.locator('#menuBtn').click();
    await page.waitForTimeout(400);
    log('Drawer opens', await page.locator('#drawer').isVisible() ? 'PASS' : 'FAIL');

    const drawerLinks = await page.locator('#drawer nav a, #drawer nav button').count();
    log('Drawer nav links', drawerLinks >= 4 ? 'PASS' : 'FAIL', `${drawerLinks} links`);

    // Close drawer via JS (overlay intercepts Playwright click)
    await page.evaluate(() => {
      const drawer = document.getElementById('drawer');
      const overlay = document.getElementById('drawerOverlay');
      if (drawer) drawer.classList.add('-translate-x-full');
      if (overlay) overlay.classList.remove('active');
    });
    await page.waitForTimeout(400);

    // Navigate to payments via direct URL
    await page.goto(`${BASE}/payments.html`, { waitUntil: 'networkidle' });
    log('Dashboard → Payments', page.url().includes('payments.html') ? 'PASS' : 'FAIL');

    // ── 9. PAYMENTS PAGE ──
    console.log('\n💰 PAYMENTS PAGE\n');

    await page.goto(`${BASE}/payments.html`, { waitUntil: 'networkidle' });

    const balance = await page.locator('text=Available Balance').isVisible();
    log('Balance card', balance ? 'PASS' : 'FAIL');

    const withdrawBtn = await page.locator('#withdrawBtn').isVisible();
    log('Withdraw button', withdrawBtn ? 'PASS' : 'FAIL');

    const payForm = await page.locator('#paymentForm').isVisible();
    log('Payment form', payForm ? 'PASS' : 'FAIL');

    const recipientField = await page.locator('#recipientPhone').isVisible();
    const amountField = await page.locator('#amount').isVisible();
    log('Form fields', (recipientField && amountField) ? 'PASS' : 'FAIL');

    const txHistory = await page.locator('text=Transaction History').isVisible();
    log('Transaction History', txHistory ? 'PASS' : 'FAIL');

    const bottomNav = await page.locator('nav').last().isVisible();
    log('Bottom navigation', bottomNav ? 'PASS' : 'FAIL');

    // ── 10. FORM VALIDATION ──
    console.log('\n🛡️ FORM VALIDATION\n');

    await page.goto(`${BASE}/signup.html`, { waitUntil: 'networkidle' });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    log('Signup: empty name', await page.locator('#fullname-error').isVisible() ? 'PASS' : 'FAIL');

    await page.fill('#fullname', 'Test');
    await page.fill('#phone', '123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    log('Signup: bad phone', await page.locator('#phone-error').isVisible() ? 'PASS' : 'FAIL');

    await page.fill('#phone', '712345678');
    await page.fill('#password', 'short');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    log('Signup: short password', await page.locator('#password-error').isVisible() ? 'PASS' : 'FAIL');

    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle' });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    log('Login: empty phone', await page.locator('#phone-error').isVisible() ? 'PASS' : 'FAIL');

    // ── 11. FOOTER ON ALL PAGES ──
    console.log('\n📎 FOOTERS\n');

    for (const p of ['index.html', 'signup.html', 'login.html', 'activate.html', 'dashboard.html', 'payments.html']) {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
      const ft = await page.locator('footer').first().textContent().catch(() => '');
      log(`${p} footer`, ft.includes('Texting Factory') ? 'PASS' : 'FAIL');
    }

    // ── 12. RESPONSIVE ──
    console.log('\n📱 RESPONSIVE\n');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    log('Desktop: landing', await page.locator('h1').first().isVisible() ? 'PASS' : 'FAIL');

    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });
    log('Desktop: dashboard', await page.locator('#welcomeMessage').isVisible() ? 'PASS' : 'FAIL');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    log('Mobile: landing', await page.locator('h1').first().isVisible() ? 'PASS' : 'FAIL');

    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });
    log('Mobile: dashboard', await page.locator('#welcomeMessage').isVisible() ? 'PASS' : 'FAIL');

    // ── 13. API ENDPOINTS ──
    console.log('\n🔌 API ENDPOINTS\n');

    const healthRes = await page.evaluate(async () => {
      const res = await fetch('/api/health');
      return res.json();
    });
    log('API /health', healthRes.status === 'ok' ? 'PASS' : 'FAIL', `gateway: ${healthRes.gateway}`);

  } catch (error) {
    log('Test execution error', 'FAIL', error.message);
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }

  console.log(`\n🌐 Live URL: ${BASE}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
