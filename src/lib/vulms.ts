// VULMS automation library
// Uses puppeteer-core + @sparticuz/chromium on Vercel
// Uses puppeteer-core + local Chrome on development

import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';

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

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--window-size=1280,720',
  '--disable-blink-features=AutomationControlled',
];

// Check if running on Vercel serverless
const isVercel = process.env.VERCEL === '1';

async function launchBrowser(): Promise<Browser> {
  if (isVercel) {
    // On Vercel serverless — use @sparticuz/chromium
    const chromium = await import('@sparticuz/chromium');
    
    const browser = await puppeteer.launch({
      args: [...chromium.default.args, ...BROWSER_ARGS],
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
      ignoreHTTPSErrors: true,
    });
    return browser;
  }

  // Local development — use system Chrome/Chromium
  // Try common paths for Chrome
  const executablePath = getLocalChromePath();
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: BROWSER_ARGS,
  });
  return browser;
}

function getLocalChromePath(): string {
  const platform = process.platform;
  
  if (platform === 'linux') {
    // Common Linux Chrome paths
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    const fs = require('fs');
    for (const p of paths) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
  } else if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  
  // Fallback — let puppeteer-core figure it out
  return '/usr/bin/google-chrome-stable';
}

function addStealthScripts(page: Page) {
  page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ur'] });
    (window as Record<string, unknown>).chrome = { runtime: {} };
  });
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function loginToVULMS(studentId: string, password: string) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  addStealthScripts(page);

  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to VULMS login page
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for login form — ASP.NET WebForms selectors
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });

    await randomDelay(500, 1500);

    // Fill Student ID
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', studentId, { delay: 40 + Math.random() * 60 });

    await randomDelay(300, 800);

    // Fill Password
    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', password, { delay: 40 + Math.random() * 60 });

    await randomDelay(500, 1200);

    // Wait for reCAPTCHA v3 (invisible — auto-fills in background)
    await page.waitForFunction(
      () => {
        const recaptchaField = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        return recaptchaField && recaptchaField.value && recaptchaField.value.length > 10;
      },
      { timeout: 15000 }
    ).catch(() => {
      console.log('reCAPTCHA token not found, proceeding without it');
    });

    await randomDelay(500, 1000);

    // Click Sign In button
    await Promise.all([
      page.click('#ibtnLogin'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(async () => {
      // Fallback: submit form via JS
      await page.evaluate(() => {
        const form = document.querySelector('#ctl00') as HTMLFormElement;
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    });

    // Check if login was successful
    const loginFormVisible = await page.evaluate(() => {
      const usernameField = document.querySelector('#txtStudentID') as HTMLInputElement;
      return usernameField && usernameField.offsetParent !== null;
    });

    if (loginFormVisible) {
      const errorMsg = await page.evaluate(() => {
        const errEl = document.querySelector('.alert-danger, .error, .login-error, .m-alert');
        return errEl ? errEl.textContent?.trim() : '';
      });
      await browser.close();
      throw new Error(errorMsg || 'Login failed. Please check your Student ID and Password. Make sure your VULMS account is active.');
    }

    // Get cookies
    const cookies = await page.cookies();

    // Get subjects from dashboard
    const subjects = await scrapeSubjects(page);

    return { success: true, cookies, subjects, browser };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function scrapeSubjects(page: Page): Promise<SubjectInfo[]> {
  try {
    await randomDelay(1000, 2000);

    const subjects = await page.evaluate(() => {
      const results: Array<{ name: string; code: string; url: string }> = [];

      // Strategy 1: Course links on dashboard
      const courseLinks = document.querySelectorAll(
        'a[href*="CourseHome"], a[href*="coursehome"], a[href*="StudentHome"], a[href*="studenthome"], ' +
        '.m-portlet a[href*="Home"], .course-card a, .subject-card a, ' +
        'a[href*="Home.aspx"], a[href*="home.aspx"]'
      );
      courseLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        if (text && href) results.push({ name: text, code: '', url: href });
      });

      // Strategy 2: Find VU subject codes (CS101, MTH301, etc.)
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

export async function getSubjects(cookies: VULMSCookie[], existingBrowser?: Browser) {
  let browser = existingBrowser;
  let ownBrowser = false;

  if (!browser) {
    browser = await launchBrowser();
    ownBrowser = true;
  }

  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    await page.goto(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
    const subjects = await scrapeSubjects(page);
    return subjects;
  } finally {
    await page.close();
    if (ownBrowser && browser) await browser.close();
  }
}

export async function getHandouts(cookies: VULMSCookie[], courseUrl: string) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    await page.goto(courseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay(1000, 2000);

    const handouts = await page.evaluate(() => {
      const results: Array<{ name: string; url: string; type: string }> = [];
      const selectors = [
        'a[href*="Handout"]', 'a[href*="handout"]', 'a[href*="Lecture"]', 'a[href*="lecture"]',
        'a[href*="Content"]', 'a[href*="Resource"]', 'a[href*="Download"]', 'a[href*=".pdf"]',
        'a[href*=".pptx"]', 'a[href*="Lesson"]',
      ];

      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          if (text && href && !href.includes('javascript')) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            const type = href.toLowerCase().includes('.pdf') ? 'pdf' :
                         href.toLowerCase().includes('.pptx') || href.toLowerCase().includes('.ppt') ? 'pptx' : 'document';
            results.push({ name: text, url: fullUrl, type });
          }
        });
      });

      const seen = new Set<string>();
      return results.filter((r) => { if (seen.has(r.url)) return false; seen.add(r.url); return true; });
    });

    return handouts;
  } finally {
    await browser.close();
  }
}

export async function downloadHandoutContent(cookies: VULMSCookie[], handoutUrl: string) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    await page.goto(handoutUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    const content = await page.evaluate(() => {
      const mainContent =
        document.querySelector('#region-main') ||
        document.querySelector('.m-portlet__body') ||
        document.querySelector('main') ||
        document.body;
      return mainContent?.innerText || '';
    });
    return content;
  } finally {
    await browser.close();
  }
}
