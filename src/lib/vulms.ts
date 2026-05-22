import puppeteer from 'puppeteer';

const VULMS_BASE = 'https://vulms.vu.edu.pk';
const VULMS_LOGIN = 'https://vulms.vu.edu.pk/login/index.php';

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

export async function loginToVULMS(studentId: string, password: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to login page
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 30000 });

    // Fill login form
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', studentId, { delay: 50 });
    await page.type('#password', password, { delay: 50 });

    // Click login button
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    ]);

    // Check if login was successful
    const currentUrl = page.url();
    if (currentUrl.includes('login') && !currentUrl.includes('my')) {
      // Check for error message on page
      const errorMsg = await page.evaluate(() => {
        const errEl = document.querySelector('.error, .alert-danger, .loginerrors');
        return errEl ? errEl.textContent?.trim() : '';
      });
      await browser.close();
      throw new Error(errorMsg || 'Login failed. Please check your credentials.');
    }

    // Get cookies
    const cookies = await page.cookies();

    return { success: true, cookies, browser };
  } catch (error) {
    await browser.close();
    throw error;
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    ownBrowser = true;
  }

  const page = await browser.newPage();
  await page.setCookie(...cookies);

  try {
    // Navigate to dashboard
    await page.goto(`${VULMS_BASE}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Scrape subject list - VULMS uses Moodle
    let subjects = await page.evaluate(() => {
      const courseElements = document.querySelectorAll(
        '.course_list a, [data-region="course-content"] a, .mycourse a, .course-title a, a[href*="course/view"]'
      );
      return Array.from(courseElements)
        .map((el) => ({
          name: (el.textContent || '').trim(),
          url: el.getAttribute('href') || '',
        }))
        .filter((s) => s.name && s.url);
    });

    // If no subjects found, try alternative selectors
    if (subjects.length === 0) {
      subjects = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="course"]');
        return Array.from(links)
          .map((el) => ({
            name: (el.textContent || '').trim(),
            url: el.getAttribute('href') || '',
          }))
          .filter((s) => s.name && s.url && s.url.includes('course/view'));
      });
    }

    // Parse subject codes from names
    const parsedSubjects: SubjectInfo[] = subjects.map((s) => {
      const codeMatch = s.name.match(/^([A-Z]{2,4}\d{3})/);
      const code = codeMatch ? codeMatch[1] : s.name.split(' ')[0] || 'UNKNOWN';
      return {
        name: s.name,
        code,
        url: s.url,
      };
    });

    return parsedSubjects;
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setCookie(...cookies);

  try {
    await page.goto(courseUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Find handout/lecture links
    const handouts = await page.evaluate(() => {
      const links = document.querySelectorAll(
        'a[href*="mod/resource"], a[href*="mod/folder"], a[href*="mod/url"], a[href*="file"]'
      );
      return Array.from(links)
        .map((el) => ({
          name: (el.textContent || '').trim(),
          url: el.getAttribute('href') || '',
          type: (
            el.querySelector('img')?.getAttribute('alt') || 'document'
          ).toLowerCase(),
        }))
        .filter((h) => h.name && h.url);
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
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
        document.querySelector('main') ||
        document.body;
      return mainContent?.innerText || '';
    });

    return content;
  } finally {
    await browser.close();
  }
}
