// VULMS automation library — Puppeteer-based for Railway/Docker deployment
// Uses real browser to handle reCAPTCHA v3 and ASP.NET WebForms postbacks
// All navigation done through Puppeteer clicks (no direct URLs work with ASP.NET)
//
// VULMS HTML Structure (discovered via diagnostic):
// - Dashboard: GridView with ibtnCourseHome links per subject
// - Course Home: lstWeeklySchedule > rptIndex items per week
//   - lbtnViewLesson: Lesson links (use __doPostBack)
//   - lbtnActivity: Quiz/Assignment links (use WebForm_DoPostBackWithOptions)
// - Navigation tabs: Index, Course Information, FAQs, Glossary, Books, DownloadFiles, InternetLinks, GradingScheme
// - Download Files tab shows lesson links, NOT direct PDFs
// - Videos are inside individual lesson pages (not on course home)

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
  url: string; // eventTarget for postback navigation
}

export interface HandoutInfo {
  name: string;
  url: string; // eventTarget for lesson postback
  type: string;
  lessonNumber: number;
  weekNumber: number;
}

export interface VideoLectureInfo {
  name: string;
  youtubeUrl: string;
  lessonNumber: string;
}

export interface VULMSQuizInfo {
  name: string;
  openDate: string;
  closeDate: string;
  status: 'completed' | 'not_started' | 'in_progress' | 'expired';
  score?: string;
  eventTarget?: string;
  weekNumber: number;
}

export interface VULMSAssignmentInfo {
  name: string;
  dueDate: string;
  status: 'submitted' | 'not_submitted' | 'overdue' | 'graded';
  score?: string;
  eventTarget?: string;
  weekNumber: number;
}

// ─── PUPPETEER HELPERS ────────────────────────────────────────────────────────

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

async function createBrowserPage(cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>) {
  const puppeteerModule = await getPuppeteer();
  if (!puppeteerModule) {
    throw new Error('Puppeteer is not available.');
  }

  const puppeteer = puppeteerModule;
  const executablePath = getChromePath();

  const browser = await puppeteer.default.launch({
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

  if (cookies && cookies.length > 0) {
    await page.setCookie(...cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || 'vulms.vu.edu.pk',
      path: c.path || '/',
    })));
  }

  return { browser, page };
}

// ─── MAIN LOGIN ────────────────────────────────────────────────────────────────

export async function loginToVULMS(studentId: string, password: string, _recaptchaToken: string = '') {
  const puppeteerModule = await getPuppeteer();
  if (!puppeteerModule) {
    throw new Error('Puppeteer is not available. Please deploy on Railway with Docker support.');
  }

  console.log('[VULMS] Using Puppeteer login for:', studentId);
  const { browser, page } = await createBrowserPage();

  try {
    console.log('[VULMS] Loading login page...');
    await page.goto(VULMS_LOGIN, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });

    // Wait for reCAPTCHA v3 token
    console.log('[VULMS] Waiting for reCAPTCHA token...');
    await page.waitForFunction(
      () => {
        const field = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        return field && field.value && field.value.length > 10;
      },
      { timeout: 15000 }
    ).catch(() => console.log('[VULMS] reCAPTCHA token not found, proceeding anyway'));

    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    // Fill credentials
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', studentId, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', password, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

    // Click Sign In
    console.log('[VULMS] Clicking Sign In...');
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

    // Check if login successful
    const currentUrl = page.url();
    const pageContent = await page.content();
    const stillOnLoginPage = pageContent.includes('txtStudentID') && pageContent.includes('txtPassword');

    if (stillOnLoginPage) {
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector('#lblError');
        return el ? el.textContent?.trim() : '';
      });
      await browser.close();
      throw new Error(errorMsg || 'Login failed. Please check your Student ID and Password.');
    }

    console.log('[VULMS] Login successful! URL:', currentUrl);

    // Get session cookies
    const cookies = await page.cookies();

    // Navigate to dashboard if needed
    if (!currentUrl.toLowerCase().includes('home.aspx')) {
      console.log('[VULMS] Navigating to Home...');
      await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // ── SCRAPE SUBJECTS ──
    console.log('[VULMS] Scraping subjects...');
    const subjects = await page.evaluate(() => {
      const results: Array<{ name: string; code: string; eventTarget: string }> = [];
      const seen = new Set<string>();

      // VULMS uses GridView: MainContent_gvCourseList_ibtnCourseHome_X
      const courseLinks = document.querySelectorAll('a[id*="ibtnCourseHome"]');
      courseLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';

        // Extract subject code (e.g. ECO402, MGMT627, MGT602)
        const codeMatch = text.match(/([A-Z]{2,5}\d{3}[A-Z]?)/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : '';

        if (!code || code.length < 4) return;
        if (seen.has(code)) return;
        seen.add(code);

        // Extract the postback event target
        const match = href.match(/__doPostBack\('([^']+)'/);
        const eventTarget = match ? match[1] : '';

        if (eventTarget) {
          // Clean up name - remove instructor, credit hours etc
          const nameParts = text.split(/\s{2,}/);
          const cleanName = nameParts[0] || text;
          results.push({ name: cleanName, code, eventTarget });
        }
      });

      return results;
    });

    console.log('[VULMS] Found subjects:', subjects.length, subjects.map(s => s.code));

    const formattedSubjects: SubjectInfo[] = subjects.map(s => ({
      name: s.name,
      code: s.code,
      url: s.eventTarget,
    }));

    await browser.close();

    return {
      success: true,
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || 'vulms.vu.edu.pk',
        path: c.path || '/',
      })),
      subjects: formattedSubjects,
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

// ─── NAVIGATE TO COURSE PAGE ───────────────────────────────────────────────────

async function navigateToCourse(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const { browser, page } = await createBrowserPage(cookies);

  try {
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 45000 });

    const pageContent = await page.content();
    if (page.url().includes('Login') || pageContent.includes('txtStudentID')) {
      await browser.close();
      throw new Error('Session expired. Please login again.');
    }

    // Click on the course using postback
    console.log('[VULMS] Navigating to course:', courseEventTarget);
    await page.evaluate((target) => {
      (window as any).__doPostBack(target, '');
    }, courseEventTarget);

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    console.log('[VULMS] Course page URL:', page.url());

    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

// ─── GET ALL COURSE DATA (comprehensive - from Course Home page) ──────────────
// This is the main function that scrapes everything from the course home page

export async function getAllCourseData(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const { browser, page } = await navigateToCourse(cookies, courseEventTarget);

  try {
    console.log('[VULMS AllData] Scraping all course data from Course Home...');

    const courseData = await page.evaluate(() => {
      const result: {
        handouts: Array<{ name: string; url: string; type: string; lessonNumber: number; weekNumber: number }>;
        videos: Array<{ name: string; youtubeUrl: string; lessonNumber: string }>;
        quizzes: Array<{ name: string; openDate: string; closeDate: string; status: string; score: string; eventTarget: string; weekNumber: number }>;
        assignments: Array<{ name: string; dueDate: string; status: string; score: string; eventTarget: string; weekNumber: number }>;
        gdbs: Array<{ name: string; openDate: string; closeDate: string; status: string; eventTarget: string }>;
        lessons: Array<{ name: string; eventTarget: string; lessonNumber: number; weekNumber: number; status: string }>;
      } = {
        handouts: [],
        videos: [],
        quizzes: [],
        assignments: [],
        gdbs: [],
        lessons: [],
      };

      const seen = new Set<string>();

      // ─── SCRAPE LESSONS & ACTIVITIES FROM WEEKLY SCHEDULE ───
      // VULMS pattern: lstWeeklySchedule > rptIndex items
      // Lesson links: id="MainContent_lstWeeklySchedule_rptIndex_X_lbtnViewLesson_Y"
      // Activity links: id="MainContent_lstWeeklySchedule_rptIndex_X_lbtnActivity_Y"
      //   - Activities use WebForm_DoPostBackWithOptions (NOT __doPostBack)

      const weeklyItems = document.querySelectorAll('[id*="lstWeeklySchedule"] [id*="rptIndex"]');

      let currentWeek = 0;
      let lessonCount = 0;

      weeklyItems.forEach((item) => {
        // Detect week changes by looking at week containers
        const weekMatch = item.id?.match(/rptIndex_(\d+)/);
        if (weekMatch) {
          currentWeek = parseInt(weekMatch[1]) + 1; // Weeks are 0-indexed
        }

        // Lesson links
        const lessonLinks = item.querySelectorAll('a[id*="lbtnViewLesson"]');
        lessonLinks.forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
          const href = link.getAttribute('href') || '';
          const id = link.id || '';

          if (!text || seen.has('lesson:' + id)) return;
          seen.add('lesson:' + id);

          lessonCount++;

          // Extract eventTarget from __doPostBack
          const match = href.match(/__doPostBack\('([^']+)'/);
          const eventTarget = match ? match[1] : '';

          // Determine lesson status from surrounding text
          const parentText = link.closest('tr, div, li')?.textContent?.toLowerCase() || '';
          const status = parentText.includes('open') ? 'open' : 'closed';

          if (eventTarget) {
            result.lessons.push({
              name: text,
              eventTarget,
              lessonNumber: lessonCount,
              weekNumber: currentWeek,
              status,
            });

            // Each lesson IS a handout in VULMS
            result.handouts.push({
              name: text,
              url: eventTarget,
              type: 'lesson',
              lessonNumber: lessonCount,
              weekNumber: currentWeek,
            });
          }
        });

        // Activity links (Quiz, Assignment, GDB)
        const activityLinks = item.querySelectorAll('a[id*="lbtnActivity"]');
        activityLinks.forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
          const href = link.getAttribute('href') || '';
          const id = link.id || '';

          if (!text || seen.has('activity:' + id)) return;
          seen.add('activity:' + id);

          // Activity uses WebForm_DoPostBackWithOptions - extract eventTarget differently
          let eventTarget = '';
          const doPostBackMatch = href.match(/__doPostBack\('([^']+)'/);
          const webFormMatch = href.match(/WebForm_PostBackOptions\("([^"]+)"/);

          if (doPostBackMatch) {
            eventTarget = doPostBackMatch[1];
          } else if (webFormMatch) {
            eventTarget = webFormMatch[1];
          }

          const lowerText = text.toLowerCase();

          if (lowerText.includes('quiz')) {
            result.quizzes.push({
              name: text,
              openDate: '',
              closeDate: '',
              status: 'not_started',
              score: '',
              eventTarget,
              weekNumber: currentWeek,
            });
          } else if (lowerText.includes('assignment') || lowerText.includes('assign')) {
            result.assignments.push({
              name: text,
              dueDate: '',
              status: 'not_submitted',
              score: '',
              eventTarget,
              weekNumber: currentWeek,
            });
          } else if (lowerText.includes('gdb') || lowerText.includes('graded discussion')) {
            result.gdbs.push({
              name: text,
              openDate: '',
              closeDate: '',
              status: 'not_posted',
              eventTarget,
            });
          }
        });
      });

      // ─── ALSO CHECK FOR YOUTUBE/VIDEO LINKS ON COURSE HOME ───
      const ytIframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
      ytIframes.forEach((iframe, index) => {
        const src = iframe.getAttribute('src') || '';
        if (src && !seen.has('yt:' + src)) {
          seen.add('yt:' + src);
          const videoIdMatch = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
          const ytUrl = videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : src;
          result.videos.push({
            name: `Video Lecture ${index + 1}`,
            youtubeUrl: ytUrl,
            lessonNumber: String(index + 1),
          });
        }
      });

      const ytLinks = document.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
      ytLinks.forEach((el, index) => {
        const link = el as HTMLAnchorElement;
        const href = link.href || '';
        const text = link.textContent?.trim().replace(/\s+/g, ' ') || `Video Lecture ${index + 1}`;
        if (!href || seen.has('yt:' + href)) return;
        seen.add('yt:' + href);

        const videoIdMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
        const ytUrl = videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : href;

        result.videos.push({
          name: text,
          youtubeUrl: ytUrl,
          lessonNumber: String(index + 1),
        });
      });

      return result;
    });

    console.log('[VULMS AllData] Results:', {
      handouts: courseData.handouts.length,
      videos: courseData.videos.length,
      quizzes: courseData.quizzes.length,
      assignments: courseData.assignments.length,
      gdbs: courseData.gdbs.length,
      lessons: courseData.lessons.length,
    });

    // ─── NOW CLICK "Download Files" TAB TO GET ACTUAL DOWNLOAD LINKS ───
    console.log('[VULMS AllData] Clicking Download Files tab...');
    const downloadTabClicked = await page.evaluate(() => {
      const el = document.querySelector('#DownloadFiles') as HTMLAnchorElement;
      if (el) { el.click(); return true; }
      // Fallback: find by text
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.textContent?.trim().toLowerCase().includes('download files')) {
          (link as HTMLAnchorElement).click();
          return true;
        }
      }
      return false;
    });

    if (downloadTabClicked) {
      await new Promise(r => setTimeout(r, 3000));

      // Scrape download file links
      const downloadFiles = await page.evaluate(() => {
        const files: Array<{ name: string; url: string; type: string }> = [];
        const seen = new Set<string>();

        // Look for actual file download links (PDF, PPTX, etc.)
        document.querySelectorAll('a').forEach((el) => {
          const link = el as HTMLAnchorElement;
          const href = link.href || '';
          const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';

          // Direct file links
          if (href.match(/\.(pdf|pptx|ppt|docx|doc|zip|rar)(\?|$)/i)) {
            if (!seen.has(href) && text) {
              seen.add(href);
              const ext = href.match(/\.(\w+)(\?|$)/)?.[1]?.toUpperCase() || 'FILE';
              files.push({ name: text, url: href, type: ext });
            }
          }
        });

        return files;
      });

      console.log('[VULMS AllData] Download files found:', downloadFiles.length);

      // If we found actual downloadable files, add them as handouts
      if (downloadFiles.length > 0) {
        downloadFiles.forEach((file, i) => {
          // Don't duplicate if already in handouts
          if (!courseData.handouts.find(h => h.name === file.name)) {
            courseData.handouts.push({
              name: file.name,
              url: file.url,
              type: file.type,
              lessonNumber: courseData.handouts.length + 1,
              weekNumber: 0,
            });
          }
        });
      }
    }

    await browser.close();
    return courseData;
  } catch (error) {
    await browser.close().catch(() => {});
    console.error('[VULMS AllData] Error:', error instanceof Error ? error.message : error);
    return {
      handouts: [],
      videos: [],
      quizzes: [],
      assignments: [],
      gdbs: [],
      lessons: [],
    };
  }
}

// ─── GET HANDOUTS (compatibility wrapper) ──
export async function getHandouts(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const data = await getAllCourseData(cookies, courseEventTarget);
  return data.handouts;
}

// ─── GET VIDEO LECTURES ──
export async function getVideoLectures(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const data = await getAllCourseData(cookies, courseEventTarget);
  return data.videos;
}

// ─── GET QUIZZES ──
export async function getQuizzes(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const data = await getAllCourseData(cookies, courseEventTarget);
  return data.quizzes;
}

// ─── GET ASSIGNMENTS ──
export async function getAssignments(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const data = await getAllCourseData(cookies, courseEventTarget);
  return data.assignments;
}

// ─── GET GDBs ──
export async function getGDBs(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const data = await getAllCourseData(cookies, courseEventTarget);
  return data.gdbs;
}

// ─── GET SUBJECTS (re-scan) ──
export async function getSubjects(cookies: Array<{ name: string; value: string; domain?: string; path?: string }>) {
  const { browser, page } = await createBrowserPage(cookies);

  try {
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 45000 });

    if (page.url().includes('Login') || (await page.content()).includes('txtStudentID')) {
      await browser.close();
      throw new Error('Session expired. Please login again.');
    }

    const subjects = await page.evaluate(() => {
      const results: Array<{ name: string; code: string; eventTarget: string }> = [];
      const seen = new Set<string>();
      const courseLinks = document.querySelectorAll('a[id*="ibtnCourseHome"]');
      courseLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const codeMatch = text.match(/([A-Z]{2,5}\d{3}[A-Z]?)/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : '';
        if (!code || code.length < 4 || seen.has(code)) return;
        seen.add(code);
        const match = href.match(/__doPostBack\('([^']+)'/);
        const eventTarget = match ? match[1] : '';
        if (eventTarget) results.push({ name: text, code, eventTarget });
      });
      return results;
    });

    await browser.close();
    return subjects.map(s => ({ name: s.name, code: s.code, url: s.eventTarget }));
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

// ─── DOWNLOAD HANDOUT CONTENT ──
// Navigate to a lesson page and extract text content

export async function downloadHandoutContent(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  lessonEventTarget: string
) {
  const { browser, page } = await createBrowserPage(cookies);

  try {
    // First navigate to dashboard, then we need to navigate to the course
    // For lessons, we need to be on the CourseHome page first
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 45000 });

    // Check if this is a direct URL or an eventTarget
    if (lessonEventTarget.startsWith('http')) {
      await page.goto(lessonEventTarget, { waitUntil: 'networkidle2', timeout: 45000 });
    } else {
      // It's an eventTarget - try postback from dashboard
      // Note: lbtnViewLesson postbacks work from CourseHome page, not dashboard
      // We need to navigate to the course first, but we don't have the course eventTarget here
      // For now, try direct postback - may or may not work depending on VULMS state
      console.log('[VULMS Content] Opening lesson:', lessonEventTarget);
      await page.evaluate((target) => {
        (window as any).__doPostBack(target, '');
      }, lessonEventTarget);

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    }

    // Wait for content to load
    await new Promise(r => setTimeout(r, 2000));

    // Extract content from the lesson page
    const content = await page.evaluate(() => {
      // Try multiple content selectors for VULMS lesson page
      const selectors = [
        '#MainContent',
        '#divLessonContent',
        '.lesson-content',
        '.m-portlet__body',
        '.content-area',
        '#ContentPlaceHolder1',
        'main',
        '.portlet-body',
        '.m-section__content',
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }

      // Fallback: get main body text but exclude navigation
      const body = document.body.cloneNode(true) as HTMLElement;
      // Remove nav, header, footer elements
      body.querySelectorAll('nav, header, footer, script, style, .m-header, .m-footer').forEach(el => el.remove());
      return body.textContent?.trim() || 'Content not available.';
    });

    await browser.close();
    return content.replace(/\s+/g, ' ').trim();
  } catch (error) {
    await browser.close().catch(() => {});
    console.error('[VULMS Content] Error:', error instanceof Error ? error.message : error);
    return 'Failed to load content. Please try again.';
  }
}

// ─── DEBUG: DUMP PAGE HTML ──
export async function debugDumpPage(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  url: string
) {
  const { browser, page } = await createBrowserPage(cookies);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    const data = await page.evaluate(() => {
      const links: Array<{ text: string; href: string; id: string }> = [];
      document.querySelectorAll('a').forEach((el) => {
        const link = el as HTMLAnchorElement;
        links.push({
          text: link.textContent?.trim().substring(0, 100) || '',
          href: link.getAttribute('href') || '',
          id: link.id || '',
        });
      });

      return {
        html: document.body.innerHTML.substring(0, 10000),
        links,
        text: document.body.innerText.substring(0, 5000),
      };
    });

    await browser.close();
    return data;
  } catch (error) {
    await browser.close().catch(() => {});
    console.error('[VULMS Debug] Error:', error instanceof Error ? error.message : error);
    return { html: '', links: [], text: '' };
  }
}
