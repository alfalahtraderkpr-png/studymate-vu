import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

// ─── Puppeteer helpers (inlined to avoid circular deps) ──────────────────────

async function getPuppeteer() {
  try {
    return await import('puppeteer');
  } catch {
    return null;
  }
}

function getChromePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
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

const VULMS_BASE = 'https://vulms.vu.edu.pk';
const VULMS_LOGIN = 'https://vulms.vu.edu.pk/';

// ─── Shared page-capture helper ──────────────────────────────────────────────

interface PageSnapshot {
  url: string;
  title: string;
  htmlPreview: string;
  anchors: Array<{ id: string; href: string; title: string; text: string }>;
  spans: Array<{ id: string; text: string }>;
  divs: Array<{ id: string }>;
  iframes: Array<{ src: string; id: string }>;
  bodyText: string;
}

async function capturePageSnapshot(page: import('puppeteer').Page, htmlLimit = 5000, bodyTextLimit = 3000): Promise<PageSnapshot> {
  return page.evaluate((hl: number, btl: number) => {
    const anchors: PageSnapshot['anchors'] = [];
    document.querySelectorAll('a').forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim().replace(/\s+/g, ' ').substring(0, 120) || '';
      anchors.push({
        id: a.id || '',
        href: a.getAttribute('href') || '',
        title: a.getAttribute('title') || '',
        text,
      });
    });

    const spans: PageSnapshot['spans'] = [];
    document.querySelectorAll('span[id]').forEach((el) => {
      const s = el as HTMLSpanElement;
      const t = s.textContent?.trim().substring(0, 100) || '';
      if (t) spans.push({ id: s.id, text: t });
    });

    const divs: PageSnapshot['divs'] = [];
    document.querySelectorAll('div[id]').forEach((el) => {
      const d = el as HTMLDivElement;
      if (d.id) divs.push({ id: d.id });
    });

    const iframes: PageSnapshot['iframes'] = [];
    document.querySelectorAll('iframe').forEach((el) => {
      const f = el as HTMLIFrameElement;
      iframes.push({ src: f.getAttribute('src') || '', id: f.id || '' });
    });

    return {
      url: window.location.href,
      title: document.title,
      htmlPreview: document.body.innerHTML.substring(0, hl),
      anchors,
      spans,
      divs,
      iframes,
      bodyText: (document.body.innerText || '').substring(0, btl),
    };
  }, htmlLimit, bodyTextLimit);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const puppeteerModule = await getPuppeteer();
  if (!puppeteerModule) {
    return NextResponse.json({ error: 'Puppeteer is not available.' }, { status: 500 });
  }

  let browser: import('puppeteer').Browser | undefined;

  try {
    const { studentId, password } = await request.json();
    if (!studentId || !password) {
      return NextResponse.json({ error: 'studentId and password are required' }, { status: 400 });
    }

    const puppeteer = puppeteerModule;
    const executablePath = getChromePath();

    browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: BROWSER_ARGS,
      ignoreDefaultArgs: ['--disable-extensions'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ur'] });
      (window as any).chrome = { runtime: {} };
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: LOGIN
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[FullDebug] Step 1: Logging in...');
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });

    await page.waitForFunction(
      () => {
        const field = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        return field && field.value && field.value.length > 10;
      },
      { timeout: 15000 }
    ).catch(() => console.log('[FullDebug] reCAPTCHA token not found, proceeding anyway'));

    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', studentId, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', password, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    console.log('[FullDebug] Clicking Sign In...');
    await Promise.all([
      page.click('#ibtnLogin'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(async () => {
      await page.evaluate(() => {
        const form = document.querySelector('#ctl00') as HTMLFormElement;
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    });

    const postLoginUrl = page.url();
    const postLoginContent = await page.content();
    const stillOnLoginPage = postLoginContent.includes('txtStudentID') && postLoginContent.includes('txtPassword');

    if (stillOnLoginPage) {
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector('#lblError');
        return el ? el.textContent?.trim() : '';
      });
      await browser.close();
      return NextResponse.json({ error: errorMsg || 'Login failed' }, { status: 401 });
    }

    console.log('[FullDebug] Login successful! URL:', postLoginUrl);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: CAPTURE DASHBOARD (Home.aspx)
    // ═══════════════════════════════════════════════════════════════════════════
    if (!postLoginUrl.toLowerCase().includes('home.aspx')) {
      console.log('[FullDebug] Navigating to Home.aspx...');
      await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    await new Promise(r => setTimeout(r, 1500));

    console.log('[FullDebug] Step 2: Capturing dashboard...');
    const dashboardSnapshot = await capturePageSnapshot(page, 3000, 3000);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: FIND FIRST SUBJECT AND CLICK IT
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[FullDebug] Step 3: Finding first subject link...');

    // Find first course link with __doPostBack
    const firstSubject = await page.evaluate(() => {
      const link = document.querySelector('a[id*="ibtnCourseHome"]') as HTMLAnchorElement;
      if (!link) return null;
      const href = link.getAttribute('href') || '';
      const match = href.match(/__doPostBack\('([^']+)'/);
      const codeMatch = (link.textContent || '').match(/([A-Z]{2,5}\d{3}[A-Z]?)/i);
      return {
        id: link.id,
        text: link.textContent?.trim().replace(/\s+/g, ' ').substring(0, 100) || '',
        href,
        eventTarget: match ? match[1] : '',
        code: codeMatch ? codeMatch[1].toUpperCase() : '',
      };
    });

    if (!firstSubject || !firstSubject.eventTarget) {
      console.log('[FullDebug] No subject link found on dashboard!');
      await browser.close();
      return NextResponse.json({
        step: 'dashboard',
        dashboard: dashboardSnapshot,
        error: 'No subject course link found on dashboard',
      });
    }

    console.log('[FullDebug] Found subject:', firstSubject.code, 'eventTarget:', firstSubject.eventTarget);

    // Click the subject using __doPostBack
    const courseNavStart = Date.now();
    await page.evaluate((target: string) => {
      (window as any).__doPostBack(target, '');
    }, firstSubject.eventTarget);

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
      console.log('[FullDebug] waitForNavigation timed out after postback, continuing...');
    });

    console.log('[FullDebug] After postback, URL:', page.url());

    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: CAPTURE COURSE HOME PAGE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[FullDebug] Step 4: Capturing course home page...');
    const courseHomeSnapshot = await capturePageSnapshot(page, 5000, 3000);

    // Also try a broader element search for debugging selectors
    const broaderSearch = await page.evaluate(() => {
      const lessonSelectors = [
        'a[id*="lbtnViewLesson"]',
        'a[href*="Lesson"]',
        'a[id*="Lesson"]',
        'a[title*="Lesson"]',
        'a[title*="lesson"]',
        'a:has(> img)',  // links containing images
        'a[href*="__doPostBack"]',
      ];

      const activitySelectors = [
        'a[id*="lbtnActivity"]',
        'a[href*="Activity"]',
        'a[id*="Activity"]',
        'a[title*="Activity"]',
        'a[title*="Quiz"]',
        'a[title*="Assignment"]',
        'a[title*="GDB"]',
      ];

      const results: Record<string, Array<{ id: string; href: string; text: string; title: string }>> = {};

      for (const sel of lessonSelectors) {
        try {
          const els = document.querySelectorAll(sel);
          const items: Array<{ id: string; href: string; text: string; title: string }> = [];
          els.forEach((el) => {
            const a = el as HTMLAnchorElement;
            items.push({
              id: a.id || '',
              href: a.getAttribute('href') || '',
              text: a.textContent?.trim().substring(0, 80) || '',
              title: a.getAttribute('title') || '',
            });
          });
          results[sel] = items;
        } catch {
          results[sel] = [];
        }
      }

      for (const sel of activitySelectors) {
        try {
          const els = document.querySelectorAll(sel);
          const items: Array<{ id: string; href: string; text: string; title: string }> = [];
          els.forEach((el) => {
            const a = el as HTMLAnchorElement;
            items.push({
              id: a.id || '',
              href: a.getAttribute('href') || '',
              text: a.textContent?.trim().substring(0, 80) || '',
              title: a.getAttribute('title') || '',
            });
          });
          results[sel] = items;
        } catch {
          results[sel] = [];
        }
      }

      return results;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: NAVIGATE TO QUIZ ACTIVITY PAGE
    // ═══════════════════════════════════════════════════════════════════════════
    const subjectCode = firstSubject.code;
    console.log('[FullDebug] Step 5: Navigating to Quiz page for', subjectCode);
    const quizUrl = `${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=QuizList`;

    await page.goto(quizUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const quizPageSnapshot = await capturePageSnapshot(page, 5000, 3000);

    // Also do broader search on quiz page
    const quizBroaderSearch = await page.evaluate(() => {
      const selectors = [
        'span[id*="gvTileRepeaterQuiz"]',
        'span[id*="lblTitle"]',
        'span[id*="lblStartDate"]',
        'span[id*="lblEndDate"]',
        'span[id*="lblStatus"]',
        'span[id*="lblSubmitted"]',
        'div[id*="Quiz"]',
        'div[id*="quiz"]',
        'table',
        'tr',
        'td',
      ];

      const results: Record<string, number> = {};
      for (const sel of selectors) {
        try {
          results[sel] = document.querySelectorAll(sel).length;
        } catch {
          results[sel] = 0;
        }
      }

      // Also capture specific span texts
      const spanTexts: Array<{ id: string; text: string }> = [];
      document.querySelectorAll('span[id*="gvTileRepeaterQuiz"]').forEach((el) => {
        const s = el as HTMLSpanElement;
        spanTexts.push({ id: s.id, text: s.textContent?.trim().substring(0, 100) || '' });
      });

      return { counts: results, spanTexts };
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ASSEMBLE RESPONSE
    // ═══════════════════════════════════════════════════════════════════════════
    await browser.close();

    return NextResponse.json({
      success: true,
      steps: {
        login: { url: postLoginUrl },
        dashboard: dashboardSnapshot,
        courseNavigation: {
          subject: firstSubject,
          navDurationMs: Date.now() - courseNavStart,
          postNavUrl: page.url(),
        },
        courseHome: courseHomeSnapshot,
        broaderSearch,
        quizPage: quizPageSnapshot,
        quizBroaderSearch,
      },
    });
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    const message = error instanceof Error ? error.message : 'Full debug failed';
    console.error('[FullDebug] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
