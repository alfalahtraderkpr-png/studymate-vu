// VULMS automation library
// PRIMARY: Uses Puppeteer (real browser) for login — handles reCAPTCHA v3 correctly
// FALLBACK: Uses direct HTTP requests (works without browser but reCAPTCHA may fail)
// Deploy on Railway/Render with Docker for Puppeteer support

import * as cheerio from 'cheerio';

const VULMS_BASE = 'https://vulms.vu.edu.pk';
const VULMS_LOGIN = 'https://vulms.vu.edu.pk/';

export interface VULMSCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

export interface SubjectInfo {
  name: string;
  code: string;
  url: string;
}

export interface HandoutInfo {
  name: string;
  url: string;
  type: string;
}

// Check if Puppeteer is available (works in Docker/Railway, not in Vercel)
async function isPuppeteerAvailable(): Promise<boolean> {
  try {
    const puppeteer = await import('puppeteer');
    return !!puppeteer;
  } catch {
    return false;
  }
}

// Get the Chrome/Chromium executable path
function getChromePath(): string {
  // In Docker (Railway), Chromium is installed at /usr/bin/chromium
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  // Default paths
  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  // Can't check fs in this context, just return common path
  return '/usr/bin/chromium';
}

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--window-size=1280,720',
  '--disable-blink-features=AutomationControlled',
  '--disable-extensions',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-background-networking',
];

// ─── PUPPETEER LOGIN (Primary — handles reCAPTCHA correctly) ────────────────

async function loginWithPuppeteer(studentId: string, password: string) {
  console.log('[VULMS] Using Puppeteer (browser-based) login...');

  const puppeteer = await import('puppeteer');
  const executablePath = getChromePath();

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath,
    args: BROWSER_ARGS,
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Stealth: hide automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ur'] });
      (window as Record<string, unknown>).chrome = { runtime: {} };
    });

    // Navigate to VULMS login page
    console.log('[VULMS] Navigating to login page...');
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for login form
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });
    console.log('[VULMS] Login form loaded');

    // Wait for reCAPTCHA v3 to generate token automatically
    console.log('[VULMS] Waiting for reCAPTCHA v3 token...');
    await page.waitForFunction(
      () => {
        const recaptchaField = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        return recaptchaField && recaptchaField.value && recaptchaField.value.length > 10;
      },
      { timeout: 15000 }
    ).catch(() => {
      console.log('[VULMS] reCAPTCHA token not found, proceeding anyway');
    });

    // Small delay to mimic human behavior
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    // Fill Student ID
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', studentId, { delay: 40 + Math.random() * 60 });

    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

    // Fill Password
    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', password, { delay: 40 + Math.random() * 60 });

    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    // Click Sign In button
    console.log('[VULMS] Clicking Sign In...');
    await Promise.all([
      page.click('#ibtnLogin'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(async () => {
      // Fallback: submit via JS
      await page.evaluate(() => {
        const form = document.querySelector('#ctl00') as HTMLFormElement;
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    });

    // Check if login was successful
    const currentUrl = page.url();
    const pageContent = await page.content();
    const stillOnLoginPage = pageContent.includes('txtStudentID') && pageContent.includes('txtPassword');

    if (stillOnLoginPage) {
      // Get error message from VULMS
      const errorMsg = await page.evaluate(() => {
        const lblError = document.querySelector('#lblError');
        return lblError ? lblError.textContent?.trim() : '';
      });

      await browser.close();
      throw new Error(
        errorMsg || 'Login failed. Please check your Student ID and Password. Make sure your VULMS account is active.'
      );
    }

    console.log('[VULMS] Login successful! Current URL:', currentUrl);

    // Get cookies
    const cookies = await page.cookies();

    // If not on dashboard, navigate there
    let dashboardHtml = pageContent;
    if (!currentUrl.toLowerCase().includes('lms') && !currentUrl.toLowerCase().includes('home')) {
      console.log('[VULMS] Navigating to dashboard...');
      await page.goto(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      dashboardHtml = await page.content();
    }

    // Scrape subjects
    const subjects = await scrapeSubjectsWithPuppeteer(page);

    await browser.close();

    return {
      success: true,
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || 'vulms.vu.edu.pk',
        path: c.path || '/',
      })),
      subjects,
      browser: null,
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function scrapeSubjectsWithPuppeteer(page: import('puppeteer').Page): Promise<SubjectInfo[]> {
  try {
    const subjects = await page.evaluate(() => {
      const results: Array<{ name: string; code: string; url: string }> = [];

      // Strategy 1: Course links
      const courseLinks = document.querySelectorAll(
        'a[href*="CourseHome"], a[href*="coursehome"], a[href*="StudentHome"], a[href*="studenthome"], ' +
        '.m-portlet a[href*="Home"], .course-card a, .subject-card a, ' +
        'a[href*="Home.aspx"], a[href*="home.aspx"], a[href*="CourseDetail"]'
      );
      courseLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        if (text && href && !href.includes('javascript') && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
          results.push({ name: text, code: '', url: fullUrl });
        }
      });

      // Strategy 2: Find VU subject codes
      if (results.length === 0) {
        document.querySelectorAll('a[href]').forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
          if (codeMatch && href && !href.includes('javascript') && !href.includes('#')) {
            results.push({
              name: text,
              code: codeMatch[1].toUpperCase(),
              url: href.startsWith('http') ? href : new URL(href, window.location.origin).href,
            });
          }
        });
      }

      // Deduplicate
      const seen = new Set<string>();
      return results.filter((r) => {
        const key = r.code || r.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    return subjects.map((s) => {
      if (!s.code) {
        const codeMatch = s.name.match(/^([A-Z]{2,4}\d{3})/i);
        s.code = codeMatch ? codeMatch[1].toUpperCase() : s.name.split(/\s+/)[0] || 'UNKNOWN';
      }
      return s;
    });
  } catch {
    return [];
  }
}

// ─── HTTP LOGIN (Fallback — may fail with reCAPTCHA) ────────────────────────

class CookieJar {
  private cookies: Map<string, VULMSCookie> = new Map();

  addFromSetCookie(setCookieHeaders: string[], domain: string) {
    if (!setCookieHeaders) return;
    for (const header of setCookieHeaders) {
      const parts = header.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies.set(name, {
          name, value, domain, path: '/',
          expires: 0, httpOnly: false, secure: false, sameSite: 'Lax',
        });
      }
    }
  }

  addCookies(cookies: Array<{ name: string; value: string; domain?: string; path?: string }>) {
    for (const c of cookies) {
      this.cookies.set(c.name, {
        name: c.name, value: c.value,
        domain: c.domain || 'vulms.vu.edu.pk', path: c.path || '/',
        expires: 0, httpOnly: false, secure: false, sameSite: 'Lax',
      });
    }
  }

  toString(): string {
    return Array.from(this.cookies.values())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  toArray(): Array<{ name: string; value: string; domain: string; path: string }> {
    return Array.from(this.cookies.values()).map((c) => ({
      name: c.name, value: c.value, domain: c.domain, path: c.path,
    }));
  }
}

async function loginWithHTTP(studentId: string, password: string, recaptchaToken: string = '') {
  console.log('[VULMS] Using HTTP-based login (fallback)...');
  const jar = new CookieJar();

  // GET login page
  const loginPageRes = await fetch(VULMS_LOGIN, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
    },
    redirect: 'manual',
  });

  jar.addFromSetCookie(loginPageRes.headers.getSetCookie?.() || [], 'vulms.vu.edu.pk');
  const loginHtml = await loginPageRes.text();

  // Parse ASP.NET fields
  const $ = cheerio.load(loginHtml);
  const viewstate = $('input[name="__VIEWSTATE"]').val() || '';
  const viewstategenerator = $('input[name="__VIEWSTATEGENERATOR"]').val() || '';
  const eventvalidation = $('input[name="__EVENTVALIDATION"]').val() || '';
  const actionField = $('input[name="action"]').val() || '';

  // POST login
  const loginBody = new URLSearchParams();
  loginBody.append('__VIEWSTATE', viewstate);
  loginBody.append('__VIEWSTATEGENERATOR', viewstategenerator);
  loginBody.append('__EVENTVALIDATION', eventvalidation);
  loginBody.append('txtStudentID', studentId);
  loginBody.append('txtPassword', password);
  loginBody.append('action', actionField || 'beta_LMS');
  loginBody.append('g-recaptcha-response', recaptchaToken);
  loginBody.append('ibtnLogin.x', '52');
  loginBody.append('ibtnLogin.y', '18');

  const loginPostRes = await fetch(VULMS_LOGIN, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: VULMS_LOGIN,
      Origin: VULMS_BASE,
      Cookie: jar.toString(),
    },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  jar.addFromSetCookie(loginPostRes.headers.getSetCookie?.() || [], 'vulms.vu.edu.pk');

  // Follow redirects
  let currentUrl = VULMS_LOGIN;
  let currentRes: Response = loginPostRes;
  let redirectCount = 0;

  while ([301, 302, 303, 307, 308].includes(currentRes.status) && redirectCount < 10) {
    const location = currentRes.headers.get('location');
    if (!location) break;
    const nextUrl = location.startsWith('http') ? location : new URL(location, VULMS_BASE).href;
    jar.addFromSetCookie(currentRes.headers.getSetCookie?.() || [], 'vulms.vu.edu.pk');
    currentRes = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,*/*;q=0.8',
        Cookie: jar.toString(),
      },
      redirect: 'manual',
    });
    jar.addFromSetCookie(currentRes.headers.getSetCookie?.() || [], 'vulms.vu.edu.pk');
    currentUrl = nextUrl;
    redirectCount++;
  }

  let finalHtml: string;
  if ([301, 302, 303, 307, 308].includes(currentRes.status)) {
    const loc = currentRes.headers.get('location') || '';
    const followUrl = loc.startsWith('http') ? loc : new URL(loc, VULMS_BASE).href;
    const followRes = await fetch(followUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Cookie: jar.toString() },
      redirect: 'follow',
    });
    finalHtml = await followRes.text();
    currentUrl = followRes.url;
  } else {
    finalHtml = await currentRes.text();
  }

  // Check for login failure
  if (finalHtml.includes('txtStudentID') && finalHtml.includes('txtPassword')) {
    const $$ = cheerio.load(finalHtml);
    const errorMsg = $$('#lblError').text().trim();
    throw new Error(errorMsg || 'Login failed. Please check your Student ID and Password.');
  }

  // Navigate to dashboard if needed
  if (!currentUrl.toLowerCase().includes('lms') && !currentUrl.toLowerCase().includes('home')) {
    const dashRes = await fetch(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Cookie: jar.toString() },
      redirect: 'follow',
    });
    finalHtml = await dashRes.text();
    currentUrl = dashRes.url;
  }

  const subjects = scrapeSubjectsFromHtml(finalHtml, currentUrl);
  return { success: true, cookies: jar.toArray(), subjects, browser: null };
}

function scrapeSubjectsFromHtml(html: string, pageUrl: string): SubjectInfo[] {
  const $ = cheerio.load(html);
  const results: SubjectInfo[] = [];
  const seen = new Set<string>();

  const courseSelectors = [
    'a[href*="CourseHome"]', 'a[href*="coursehome"]', 'a[href*="StudentHome"]',
    'a[href*="studenthome"]', 'a[href*="Home.aspx"]', 'a[href*="home.aspx"]',
    '.m-portlet a[href*="Home"]', '.course-card a', '.subject-card a',
    '.portlet-body a[href*="Course"]', 'a[href*="CourseDetail"]',
  ];

  for (const selector of courseSelectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';
      if (text && href && !href.includes('javascript') && !href.includes('#')) {
        if (!href.startsWith('http')) {
          try { href = new URL(href, VULMS_BASE).href; } catch { return; }
        }
        const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : '';
        const key = code || text.substring(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ name: text.replace(/\s+/g, ' ').trim(), code: code || text.split(/\s+/)[0].toUpperCase(), url: href });
        }
      }
    });
    if (results.length > 0) break;
  }

  if (results.length === 0) {
    $('a[href]').each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';
      if (!href || href.includes('javascript') || href.includes('#')) return;
      const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
      if (codeMatch) {
        if (!href.startsWith('http')) { try { href = new URL(href, VULMS_BASE).href; } catch { return; } }
        const code = codeMatch[1].toUpperCase();
        if (!seen.has(code)) { seen.add(code); results.push({ name: text.replace(/\s+/g, ' ').trim(), code, url: href }); }
      }
    });
  }

  if (results.length === 0) {
    $('table tr td a, .table tr td a, ul li a').each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';
      if (!text || !href || href.includes('javascript') || href.includes('#')) return;
      if (!href.startsWith('http')) { try { href = new URL(href, VULMS_BASE).href; } catch { return; } }
      const key = text.substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
        results.push({ name: text.replace(/\s+/g, ' ').trim(), code: codeMatch ? codeMatch[1].toUpperCase() : text.split(/\s+/)[0].toUpperCase(), url: href });
      }
    });
  }

  return results.map((s) => {
    if (!s.code || s.code.length < 2) {
      const codeMatch = s.name.match(/([A-Z]{2,4}\d{3})/i);
      s.code = codeMatch ? codeMatch[1].toUpperCase() : s.name.split(/\s+/)[0].toUpperCase();
    }
    return s;
  });
}

// ─── MAIN LOGIN (auto-detects Puppeteer availability) ───────────────────────

export async function loginToVULMS(studentId: string, password: string, recaptchaToken: string = '') {
  const hasPuppeteer = await isPuppeteerAvailable();
  console.log('[VULMS] Puppeteer available:', hasPuppeteer);

  if (hasPuppeteer) {
    try {
      return await loginWithPuppeteer(studentId, password);
    } catch (error) {
      console.warn('[VULMS] Puppeteer login failed, trying HTTP fallback:', error instanceof Error ? error.message : error);
      // If Puppeteer fails with a clear error (wrong credentials), don't try HTTP
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Incorrect') || msg.includes('Invalid') || msg.includes('check your')) {
        throw error; // Re-throw credential errors
      }
      // For other errors (browser crash etc), try HTTP fallback
    }
  }

  // Fallback: HTTP-based login
  return await loginWithHTTP(studentId, password, recaptchaToken);
}

// ─── SUBJECTS & HANDOUTS ────────────────────────────────────────────────────

export async function getSubjects(cookies: Array<{ name: string; value: string; domain?: string; path?: string }>) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const html = await res.text();
  if (html.includes('txtStudentID')) throw new Error('Session expired. Please login again.');
  return scrapeSubjectsFromHtml(html, res.url);
}

export async function getHandouts(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseUrl: string
) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(courseUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const html = await res.text();
  if (html.includes('txtStudentID')) throw new Error('Session expired. Please login again.');

  const $ = cheerio.load(html);
  const results: HandoutInfo[] = [];
  const seen = new Set<string>();

  const selectors = [
    'a[href*="Handout"]', 'a[href*="handout"]', 'a[href*="Lecture"]', 'a[href*="lecture"]',
    'a[href*="Content"]', 'a[href*="Resource"]', 'a[href*="Download"]', 'a[href*=".pdf"]',
    'a[href*=".pptx"]', 'a[href*="Lesson"]', 'a[href*="CourseContent"]', 'a[href*="StudyMaterial"]',
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';
      if (!text || !href || href.includes('javascript') || href.includes('#')) return;
      if (!href.startsWith('http')) { try { href = new URL(href, VULMS_BASE).href; } catch { return; } }
      if (seen.has(href)) return;
      seen.add(href);
      const type = href.toLowerCase().includes('.pdf') ? 'pdf'
        : href.toLowerCase().includes('.pptx') || href.toLowerCase().includes('.ppt') ? 'pptx'
        : 'document';
      results.push({ name: text.replace(/\s+/g, ' ').trim(), url: href, type });
    });
  }

  return results;
}

export async function downloadHandoutContent(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  handoutUrl: string
) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(handoutUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('pdf') || contentType.includes('octet-stream') || contentType.includes('pptx') || contentType.includes('powerpoint')) {
    return `[This is a downloadable file. URL: ${handoutUrl}]\n\nTo study this content, please download the file from VULMS directly.`;
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const mainContent =
    $('#region-main').text().trim() ||
    $('.m-portlet__body').text().trim() ||
    $('#ContentPlaceHolder1').text().trim() ||
    $('main').text().trim() ||
    $('body').text().trim();

  return mainContent.replace(/\s+/g, ' ').trim();
}
