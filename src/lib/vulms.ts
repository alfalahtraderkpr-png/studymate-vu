import puppeteer from 'puppeteer';

// VULMS is ASP.NET WebForms — NOT Moodle
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
  // Make Puppeteer look more human-like
  '--disable-blink-features=AutomationControlled',
];

function addStealthScripts(page: puppeteer.Page) {
  // Remove webdriver detection
  page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins to look real
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'ur'],
    });
    // Override chrome property
    (window as Record<string, unknown>).chrome = { runtime: {} };
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions as Record<string, unknown>).query = (parameters: Record<string, unknown>) =>
      (parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters));
  });
}

export async function loginToVULMS(studentId: string, password: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });

  const page = await browser.newPage();
  addStealthScripts(page);

  try {
    await page.setViewport({ width: 1280, height: 720 });

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to VULMS login page
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for login form — ASP.NET WebForms selectors
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });

    // Small random delays to look human
    await randomDelay(500, 1500);

    // Clear and type Student ID
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', studentId, { delay: 40 + Math.random() * 60 });

    await randomDelay(300, 800);

    // Clear and type Password
    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', password, { delay: 40 + Math.random() * 60 });

    await randomDelay(500, 1200);

    // Wait for reCAPTCHA v3 to auto-solve (it runs in background)
    // reCAPTCHA v3 invisible fills the g-recaptcha-response field automatically
    await page.waitForFunction(
      () => {
        const recaptchaField = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        return recaptchaField && recaptchaField.value && recaptchaField.value.length > 10;
      },
      { timeout: 15000 }
    ).catch(() => {
      // reCAPTCHA might not load — try anyway
      console.log('reCAPTCHA token not found, proceeding without it');
    });

    await randomDelay(500, 1000);

    // Click Sign In button
    await Promise.all([
      page.click('#ibtnLogin'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(async () => {
      // If navigation doesn't happen, try submitting form via JS
      await page.evaluate(() => {
        const form = document.querySelector('#ctl00') as HTMLFormElement;
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    });

    // Check if login was successful — look for dashboard indicators
    const currentUrl = page.url();
    const pageContent = await page.evaluate(() => document.body.innerText);

    // If still on login page, check for error
    if (currentUrl === VULMS_LOGIN || currentUrl.endsWith('/')) {
      const errorMsg = await page.evaluate(() => {
        const errEl = document.querySelector('.alert-danger, .error, .login-error, .m-alert, .validation-summary-errors');
        return errEl ? errEl.textContent?.trim() : '';
      });

      // Check if login form is still visible
      const loginFormVisible = await page.evaluate(() => {
        const usernameField = document.querySelector('#txtStudentID') as HTMLInputElement;
        return usernameField && usernameField.offsetParent !== null;
      });

      if (loginFormVisible) {
        await browser.close();
        throw new Error(errorMsg || 'Login failed. Please check your Student ID and Password. Make sure your VULMS account is active.');
      }
    }

    // Login successful — get cookies
    const cookies = await page.cookies();

    // Get subjects from dashboard
    const subjects = await scrapeSubjects(page);

    return { success: true, cookies, subjects, browser };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function scrapeSubjects(page: puppeteer.Page): Promise<SubjectInfo[]> {
  try {
    // VULMS dashboard shows enrolled courses/subjects
    // Wait for dashboard content to load
    await randomDelay(1000, 2000);

    // Try multiple selectors for course list on VULMS dashboard
    const subjects = await page.evaluate(() => {
      const results: Array<{ name: string; code: string; url: string }> = [];

      // Strategy 1: Look for course links in dashboard
      const courseLinks = document.querySelectorAll(
        'a[href*="CourseHome"], a[href*="coursehome"], a[href*="StudentHome"], a[href*="studenthome"], ' +
        '.m-portlet a[href*="Home"], .course-card a, .subject-card a, ' +
        'a[href*="Home.aspx"], a[href*="home.aspx"]'
      );

      courseLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        if (text && href) {
          results.push({ name: text, code: '', url: href });
        }
      });

      // Strategy 2: Look for any subject/course listing
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          // Look for typical VU subject patterns (e.g., CS101, MTH301, etc.)
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

      // Strategy 3: Look for table/list rows with course info
      if (results.length === 0) {
        const rows = document.querySelectorAll('table tr, .m-widget4__item, .list-group-item');
        rows.forEach((row) => {
          const link = row.querySelector('a[href]');
          if (link) {
            const text = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
            if (text && href && !href.includes('javascript')) {
              results.push({
                name: text,
                code: codeMatch ? codeMatch[1].toUpperCase() : text.split(' ')[0],
                url: href.startsWith('http') ? href : new URL(href, window.location.origin).href,
              });
            }
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

    // Parse subject codes from names if not already set
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

export async function getSubjects(
  cookies: VULMSCookie[],
  existingBrowser?: puppeteer.Browser
) {
  let browser = existingBrowser;
  let ownBrowser = false;

  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: BROWSER_ARGS,
    });
    ownBrowser = true;
  }

  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    // Navigate to VULMS dashboard
    await page.goto(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const subjects = await scrapeSubjects(page);
    return subjects;
  } finally {
    await page.close();
    if (ownBrowser && browser) {
      await browser.close();
    }
  }
}

export async function getHandouts(
  cookies: VULMSCookie[],
  courseUrl: string
) {
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });
  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    // Navigate to the course page
    await page.goto(courseUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await randomDelay(1000, 2000);

    // Scrape handout/lecture links from the course page
    const handouts = await page.evaluate(() => {
      const results: Array<{ name: string; url: string; type: string }> = [];

      // Look for handout/lecture/resource links
      const selectors = [
        'a[href*="Handout"]', 'a[href*="handout"]',
        'a[href*="Lecture"]', 'a[href*="lecture"]',
        'a[href*="Content"]', 'a[href*="content"]',
        'a[href*="Resource"]', 'a[href*="resource"]',
        'a[href*="Download"]', 'a[href*="download"]',
        'a[href*=".pdf"]', 'a[href*=".pptx"]', 'a[href*=".ppt"]',
        'a[href*="Lesson"]', 'a[href*="lesson"]',
        '.handout-link', '.lecture-link', '.resource-link',
      ];

      selectors.forEach((sel) => {
        const links = document.querySelectorAll(sel);
        links.forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          if (text && href && !href.includes('javascript')) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            const type = href.toLowerCase().includes('.pdf') ? 'pdf' :
                         href.toLowerCase().includes('.pptx') || href.toLowerCase().includes('.ppt') ? 'pptx' :
                         href.toLowerCase().includes('.doc') ? 'doc' : 'document';
            results.push({ name: text, url: fullUrl, type });
          }
        });
      });

      // Also try finding all links in content areas
      if (results.length === 0) {
        const contentAreas = document.querySelectorAll(
          '#region-main, .course-content, .m-portlet__body, .tab-content, .content-area, main'
        );
        contentAreas.forEach((area) => {
          const links = area.querySelectorAll('a[href]');
          links.forEach((el) => {
            const link = el as HTMLAnchorElement;
            const text = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            if (text && href && !href.includes('javascript') && !href.includes('#') &&
                (href.includes('.pdf') || href.includes('.ppt') || href.includes('Handout') ||
                 href.includes('Lecture') || href.includes('Download') || href.includes('Content'))) {
              const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
              results.push({ name: text, url: fullUrl, type: 'document' });
            }
          });
        });
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      return results.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    });

    return handouts;
  } finally {
    await browser.close();
  }
}

export async function downloadHandoutContent(
  cookies: VULMSCookie[],
  handoutUrl: string
) {
  const browser = await puppeteer.launch({
    headless: true,
    args: BROWSER_ARGS,
  });
  const page = await browser.newPage();
  addStealthScripts(page);
  await page.setCookie(...cookies);

  try {
    await page.goto(handoutUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract text content from the page
    const content = await page.evaluate(() => {
      // Try to get main content area first
      const mainContent =
        document.querySelector('#region-main') ||
        document.querySelector('.course-content') ||
        document.querySelector('.m-portlet__body') ||
        document.querySelector('main') ||
        document.querySelector('.content-area') ||
        document.body;
      return mainContent?.innerText || '';
    });

    return content;
  } finally {
    await browser.close();
  }
}

// Helper: random delay to look more human
function randomDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
