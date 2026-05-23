// VULMS automation library — Puppeteer-based for Railway/Docker deployment
// Uses real browser to handle reCAPTCHA v3 and ASP.NET WebForms postbacks
//
// ═══ VULMS HTML Structure (VERIFIED via diagnostic 2026-05-23) ═══
//
// Dashboard (Home.aspx):
//   - Subject links: a[id*="ibtnCourseHome"]
//   - href: javascript:__doPostBack('ctl00$MainContent$gvCourseList$ctl0X$ibtnCourseHome','')
//
// Course Home (CourseHome.aspx):
//   - Lesson links: a[id*="lbtnViewLesson"]  → __doPostBack
//   - Activity links: a[id*="lbtnActivity"]  → WebForm_DoPostBackWithOptions
//   - Navigation tabs: Index, Course Information, FAQs, Glossary, Books, DownloadFiles, InternetLinks, GradingScheme
//   - Tab IDs: a[id="Index"], a[id="DownloadFiles"], a[id="InternetLinks"], etc.
//
// Lesson Viewer (LessonViewer.aspx):
//   - YouTube iframe: iframe[src*="youtube.com/embed/"]
//   - Content iframe: iframe[src*="Courses/.../Lesson_1/"]
//   - Assessment iframe: iframe[src*="FormativeAssessment/"]
//
// Quiz Page (/Quiz/QuizList.aspx):
//   - span[id*="gvTileRepeaterQuiz_lblTitle_X"]       → "Quiz 1"
//   - span[id*="gvTileRepeaterQuiz_lblStartDate_X"]   → "May 11, 2026 12:00 AM"
//   - span[id*="gvTileRepeaterQuiz_lblEndDate_X"]     → "May 13, 2026 11:59 PM"
//   - span[id*="gvTileRepeaterQuiz_lblTotalMarks_X"]  → "10"
//   - span[id*="gvTileRepeaterQuiz_lblStatus_X"]      → "Closed" / "Open"
//   - span[id*="gvTileRepeaterQuiz_lblSubmitted_X"]   → "Result Declared" / ""
//   - span[id*="gvTileRepeaterQuiz_lblGetMarks_X"]    → "0"
//
// Assignment Page (/Assignments/StudentAssignmentListView.aspx):
//   - span[id*="gvTileRepeaterAssignment_Label3_X"]        → "Assignment" (title)
//   - span[id*="gvTileRepeaterAssignment_lblPayableAmount_X"] → "7. Consumer Preferences" (lesson)
//   - span[id*="gvTileRepeaterAssignment_lblDueDate_X"]    → "May 04, 2026"
//   - span[id*="gvTileRepeaterAssignment_lblTotalMarks_X"] → "10.00"
//   - span[id*="gvTileRepeaterAssignment_lblExpired_X"]    → "Expired" / "Submitted"
//
// GDB Page (/GDB/Default.aspx):
//   - If none: span[id="MainContent_lblmsgTile"] → "No GDB exists for this course."
//   - If exists: span[id*="gvTileRepeaterGDB_lblTitle_X"], etc.

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
  status: string; // "open" or "closed"
  duration: string;
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
  totalMarks?: string;
  eventTarget?: string;
  weekNumber: number;
}

export interface VULMSAssignmentInfo {
  name: string;
  dueDate: string;
  status: 'submitted' | 'not_submitted' | 'overdue' | 'graded';
  score?: string;
  totalMarks?: string;
  eventTarget?: string;
  weekNumber: number;
}

export interface VULMSGDBInfo {
  name: string;
  openDate: string;
  closeDate: string;
  status: 'posted' | 'not_posted' | 'overdue' | 'closed';
  totalMarks?: string;
  submitStatus?: string;
  eventTarget?: string;
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

  // Try Puppeteer's bundled Chrome locations
  const path = require('path');
  const fs = require('fs');

  // Puppeteer 24.x stores Chrome in node_modules/puppeteer-core or .cache/puppeteer
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'puppeteer', '.local-chromium', 'linux-*', 'chrome-linux64', 'chrome'),
    path.join(require('os').homedir(), '.cache', 'puppeteer', 'chrome', 'linux-*', 'chrome-linux64', 'chrome'),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];

  for (const p of possiblePaths) {
    try {
      // Handle glob patterns
      if (p.includes('*')) {
        const dir = path.dirname(p);
        const base = path.basename(p);
        const parentDir = path.dirname(dir);
        if (fs.existsSync(parentDir)) {
          const entries = fs.readdirSync(parentDir).sort().reverse(); // Latest version first
          for (const entry of entries) {
            const candidate = path.join(parentDir, entry, path.basename(path.dirname(p)), base);
            if (fs.existsSync(candidate)) {
              console.log('[VULMS] Found Chrome at:', candidate);
              return candidate;
            }
          }
        }
      } else if (fs.existsSync(p)) {
        console.log('[VULMS] Found Chrome at:', p);
        return p;
      }
    } catch { /* ignore */ }
  }

  // Let Puppeteer find its own Chrome (default behavior)
  return '';
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

  const launchOptions: Record<string, unknown> = {
    headless: true,
    args: BROWSER_ARGS,
    ignoreDefaultArgs: ['--disable-extensions'],
  };
  // Only set executablePath if we found one; otherwise let Puppeteer use its bundled Chrome
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.default.launch(launchOptions as any);

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

// ─── HELPER: Check if page is on the Dashboard (Home.aspx) specifically ──────
// IMPORTANT: CourseHome.aspx also contains "home.aspx" — we must distinguish!
function isOnDashboard(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return path === '/home.aspx' || path === '/';
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
    if (!isOnDashboard(currentUrl) && !currentUrl.toLowerCase().includes('coursehome')) {
      console.log('[VULMS] Navigating to Home...');
      await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // ── SCRAPE SUBJECTS ──
    console.log('[VULMS] Scraping subjects...');
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

        if (!code || code.length < 4) return;
        if (seen.has(code)) return;
        seen.add(code);

        const match = href.match(/__doPostBack\('([^']+)'/);
        const eventTarget = match ? match[1] : '';

        if (eventTarget) {
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

    console.log('[VULMS] Navigating to course via eventTarget:', courseEventTarget);

    // ── APPROACH 1: Use __doPostBack with Promise.all for reliable navigation ──
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.evaluate((target) => {
          (window as any).__doPostBack(target, '');
        }, courseEventTarget),
      ]);
    } catch (e) {
      console.log('[VULMS] Promise.all postback failed, trying sequential approach...');
      await page.evaluate((target) => {
        (window as any).__doPostBack(target, '');
      }, courseEventTarget);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    }

    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    const urlAfterPostback = page.url();
    console.log('[VULMS] After __doPostBack, URL:', urlAfterPostback);

    // ── VERIFY: Did we actually navigate away from the Dashboard? ──
    // FIX: Use isOnDashboard() instead of .includes('home.aspx')
    // because CourseHome.aspx also contains "home.aspx"!
    if (isOnDashboard(urlAfterPostback)) {
      console.log('[VULMS] Still on Dashboard after postback. Trying direct click...');

      // ── APPROACH 2: Find and click the actual <a> element directly ──
      const linkSelectors = [
        `a[id*="ibtnCourseHome"][href*="${courseEventTarget}"]`,
        `a[href*="__doPostBack('${courseEventTarget}'"]`,
        `a[id*="ibtnCourseHome"]`,
      ];

      let clicked = false;
      for (const sel of linkSelectors) {
        try {
          const link = await page.$(sel);
          if (link) {
            console.log('[VULMS] Found link with selector:', sel);
            await Promise.all([
              link.click(),
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            ]).catch(() => {});
            clicked = true;
            console.log('[VULMS] After direct click, URL:', page.url());
            break;
          }
        } catch (e) {
          console.log('[VULMS] Direct click failed:', e instanceof Error ? e.message : e);
        }
      }

      if (!clicked) {
        console.log('[VULMS] Trying manual form submission...');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          page.evaluate((target) => {
            const theForm = document.querySelector('form') as HTMLFormElement;
            if (theForm) {
              const hiddenTarget = document.querySelector('input[name="__EVENTTARGET"]') as HTMLInputElement;
              const hiddenArg = document.querySelector('input[name="__EVENTARGUMENT"]') as HTMLInputElement;
              if (hiddenTarget) hiddenTarget.value = target;
              if (hiddenArg) hiddenArg.value = '';
              theForm.submit();
            }
          }, courseEventTarget),
        ]).catch(() => {});
        console.log('[VULMS] After form submit, URL:', page.url());
      }
    }

    // Wait for course page content to render
    await new Promise(r => setTimeout(r, 2000));

    // Wait specifically for lesson links to appear on course page
    try {
      await page.waitForSelector('a[id*="lbtnViewLesson"]', { timeout: 8000 });
      console.log('[VULMS] Lesson links found on course page!');
    } catch {
      console.log('[VULMS] WARNING: No lesson links found on course page after navigation');
    }

    const finalUrl = page.url();
    console.log('[VULMS] Final course page URL:', finalUrl);

    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

// ─── GET ALL COURSE DATA (comprehensive) ──────────────────────────────────────

export async function getAllCourseData(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string,
  subjectCode?: string,
  skipDetails: boolean = false
) {
  const { browser, page } = await navigateToCourse(cookies, courseEventTarget);

  try {
    const currentCourseUrl = page.url();
    console.log('[VULMS AllData] Scraping all course data from:', currentCourseUrl);

    // ─── SCRAPE LESSONS & ACTIVITIES FROM COURSE HOME ───
    const courseData = await page.evaluate(() => {
      const result: {
        handouts: Array<{ name: string; url: string; type: string; lessonNumber: number; weekNumber: number; status: string; duration: string }>;
        videos: Array<{ name: string; youtubeUrl: string; lessonNumber: string }>;
        quizzes: Array<{ name: string; openDate: string; closeDate: string; status: string; score: string; totalMarks: string; eventTarget: string; weekNumber: number }>;
        assignments: Array<{ name: string; dueDate: string; status: string; score: string; totalMarks: string; eventTarget: string; weekNumber: number }>;
        gdbs: Array<{ name: string; openDate: string; closeDate: string; status: string; totalMarks: string; submitStatus: string; eventTarget: string }>;
        lessons: Array<{ name: string; eventTarget: string; lessonNumber: number; weekNumber: number; status: string; duration: string }>;
      } = {
        handouts: [],
        videos: [],
        quizzes: [],
        assignments: [],
        gdbs: [],
        lessons: [],
      };

      const seen = new Set<string>();
      let lessonCount = 0;

      // ── LESSON LINKS ──
      const lessonLinks = document.querySelectorAll('a[id*="lbtnViewLesson"]');
      console.log('[VULMS AllData] Found lesson links:', lessonLinks.length);

      lessonLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.getAttribute('title') || link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const id = link.id || '';

        if (!text || seen.has('lesson:' + id)) return;
        seen.add('lesson:' + id);

        lessonCount++;

        // Extract eventTarget from __doPostBack or WebForm_DoPostBackWithOptions
        let eventTarget = '';
        const doPostBackMatch = href.match(/__doPostBack\('([^']+)'/);
        const webFormMatch = href.match(/WebForm_PostBackOptions\("([^"]+)"/);
        if (doPostBackMatch) {
          eventTarget = doPostBackMatch[1];
        } else if (webFormMatch) {
          eventTarget = webFormMatch[1];
        }

        // Extract week number from ID: MainContent_lstWeeklySchedule_rptIndex_X_lbtnViewLesson_Y
        const weekMatch = id.match(/rptIndex_(\d+)/);
        const weekNumber = weekMatch ? parseInt(weekMatch[1]) + 1 : 0;

        // Get lesson status and duration from parent/sibling elements
        const parentDiv = link.closest('div[id*="trLesson"]') || link.closest('div[id*="Lesson"]') || link.parentElement?.parentElement;
        let status = 'closed';
        let duration = '';
        if (parentDiv) {
          const parentText = parentDiv.textContent?.toLowerCase() || '';
          status = parentText.includes('open') ? 'open' : 'closed';
          const durationSpan = parentDiv.querySelector('span[id*="lblLessonDuration"]') || parentDiv.querySelector('span[id*="Duration"]');
          if (durationSpan) {
            duration = durationSpan.textContent?.trim() || '';
          } else {
            // Try to extract duration from text (e.g., "01:08:31")
            const durationMatch = parentText.match(/(\d{2}:\d{2}:\d{2})/);
            if (durationMatch) duration = durationMatch[1];
          }
        }

        result.lessons.push({
          name: text,
          eventTarget,
          lessonNumber: lessonCount,
          weekNumber,
          status,
          duration,
        });

        result.handouts.push({
          name: text,
          url: eventTarget,
          type: 'lesson',
          lessonNumber: lessonCount,
          weekNumber,
          status,
          duration,
        });
      });

      // ── ACTIVITY LINKS ──
      const activityLinks = document.querySelectorAll('a[id*="lbtnActivity"]');
      console.log('[VULMS AllData] Found activity links:', activityLinks.length);

      activityLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const id = link.id || '';

        if (!text || seen.has('activity:' + id)) return;
        seen.add('activity:' + id);

        let eventTarget = '';
        const doPostBackMatch = href.match(/__doPostBack\('([^']+)'/);
        const webFormMatch = href.match(/WebForm_PostBackOptions\("([^"]+)"/);

        if (doPostBackMatch) {
          eventTarget = doPostBackMatch[1];
        } else if (webFormMatch) {
          eventTarget = webFormMatch[1];
        }

        const weekMatch = id.match(/rptIndex_(\d+)/);
        const weekNumber = weekMatch ? parseInt(weekMatch[1]) + 1 : 0;

        const lowerText = text.toLowerCase();

        if (lowerText.includes('quiz')) {
          result.quizzes.push({
            name: text,
            openDate: '',
            closeDate: '',
            status: 'not_started',
            score: '',
            totalMarks: '',
            eventTarget,
            weekNumber,
          });
        } else if (lowerText.includes('assignment') || lowerText.includes('assign')) {
          result.assignments.push({
            name: text,
            dueDate: '',
            status: 'not_submitted',
            score: '',
            totalMarks: '',
            eventTarget,
            weekNumber,
          });
        } else if (lowerText.includes('gdb') || lowerText.includes('graded discussion')) {
          result.gdbs.push({
            name: text,
            openDate: '',
            closeDate: '',
            status: 'not_posted',
            totalMarks: '',
            submitStatus: '',
            eventTarget,
          });
        }
      });

      return result;
    });

    console.log('[VULMS AllData] Course Home results:', {
      handouts: courseData.handouts.length,
      videos: courseData.videos.length,
      quizzes: courseData.quizzes.length,
      assignments: courseData.assignments.length,
      gdbs: courseData.gdbs.length,
      lessons: courseData.lessons.length,
      currentUrl: currentCourseUrl,
    });

    // ─── VIDEOS: NOT extracted during initial load (too slow! 45 lessons × 5s = ~4 min) ───
    // Videos are extracted on-demand via getVideoLectures() when user clicks "Study"
    // Each lesson has a YouTube iframe in LessonViewer.aspx
    console.log('[VULMS AllData] Skipping video extraction for speed. Videos will be loaded on demand.')

    // ─── If skipDetails, return just the basic course home data (FAST) ───
    // Quiz/assignment/GDB detail pages are slow (3 extra navigations × ~5s each)
    // They can be fetched later when user clicks into a subject
    if (skipDetails) {
      console.log('[VULMS AllData] skipDetails=true, returning basic course home data only');
      await browser.close();
      return courseData;
    }

    // ─── ENRICH WITH ACTIVITY PAGE DATA (dates, scores, etc.) ───
    if (subjectCode) {
      console.log('[VULMS AllData] Fetching activity details for', subjectCode);

      // ── Helper: determine quiz status ──
      const determineQuizStatus = (startDate: string, endDate: string, resultStatus: string, score: string): 'completed' | 'not_started' | 'in_progress' | 'expired' => {
        if (resultStatus.toLowerCase().includes('declared') || (score && score !== '0' && score !== '')) return 'completed';
        const now = new Date();
        if (startDate) {
          try {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date(start.getTime() + 86400000);
            if (now >= start && now <= end) return 'in_progress';
            if (now > end) return 'expired';
          } catch { /* fall through */ }
        }
        return 'not_started';
      };

      // ── Helper: determine assignment status ──
      const determineAssignmentStatus = (dueDate: string, submitStatus: string, resultStatus: string): 'submitted' | 'not_submitted' | 'overdue' | 'graded' => {
        if (submitStatus.toLowerCase().includes('submitted') && !submitStatus.toLowerCase().includes('not')) return 'submitted';
        if (submitStatus.toLowerCase().includes('expired')) return 'overdue';
        if (resultStatus.toLowerCase().includes('declared')) return 'graded';
        if (dueDate) {
          try {
            if (new Date() > new Date(dueDate)) return 'overdue';
          } catch { /* fall through */ }
        }
        return 'not_submitted';
      };

      // ── Helper: name matching ──
      const namesMatch = (a: string, b: string): boolean => {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0+(\d+)/g, '$1');
        const na = normalize(a);
        const nb = normalize(b);
        return na === nb || na.includes(nb) || nb.includes(na);
      };

      // ═══ FETCH QUIZ DETAILS ═══
      try {
        console.log('[VULMS AllData] Fetching quiz details...');
        // Navigate to quiz page (may redirect from Activity Calendar URL)
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=QuizList`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const quizUrl = page.url();
        console.log('[VULMS AllData] Quiz page URL:', quizUrl);

        const quizDetails = await page.evaluate(() => {
          const quizzes: Array<{ name: string; startDate: string; endDate: string; totalMarks: string; status: string; resultStatus: string; score: string }> = [];

          // Use the VERIFIED element IDs
          const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterQuiz_lblTitle_"]');
          console.log('Found quiz title elements:', titleEls.length);

          titleEls.forEach((el, idx) => {
            const title = el.textContent?.trim() || '';
            const startDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStartDate_${idx}"]`);
            const endDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblEndDate_${idx}"]`);
            const statusEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStatus_${idx}"]`);
            const submittedEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblSubmitted_${idx}"]`);
            const marksEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblTotalMarks_${idx}"]`);
            const scoreEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblGetMarks_${idx}"]`);

            if (title) {
              quizzes.push({
                name: title,
                startDate: startDateEl?.textContent?.trim() || '',
                endDate: endDateEl?.textContent?.trim() || '',
                totalMarks: marksEl?.textContent?.trim() || '',
                status: statusEl?.textContent?.trim() || '',
                resultStatus: submittedEl?.textContent?.trim() || '',
                score: scoreEl?.textContent?.trim() || '',
              });
            }
          });

          // Fallback: parse from body text if no structured elements
          if (quizzes.length === 0) {
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
            let inQuizSection = false;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].match(/Quiz\s*#?\s*\d+/i)) {
                inQuizSection = true;
                const name = lines[i].match(/Quiz\s*#?\s*\d+/i)?.[0] || lines[i];
                let startDate = '';
                let endDate = '';
                let totalMarks = '';
                let status = '';
                let resultStatus = '';
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                  const dateMatch = lines[j].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i);
                  if (dateMatch && !startDate) startDate = lines[j];
                  else if (dateMatch && startDate && !endDate) endDate = lines[j];
                  else if (lines[j].match(/^\d+(?:\.\d+)?$/) && !totalMarks) totalMarks = lines[j];
                  else if (lines[j].toLowerCase() === 'closed' || lines[j].toLowerCase() === 'open') status = lines[j].toLowerCase();
                  else if (lines[j].toLowerCase().includes('result')) resultStatus = lines[j];
                }
                quizzes.push({ name, startDate, endDate, totalMarks, status, resultStatus, score: '' });
              }
            }
          }

          return quizzes;
        });

        if (quizDetails.length > 0) {
          // Merge with existing quizzes from course home, or add as new
          const matchedQuizNames = new Set<string>();
          courseData.quizzes = courseData.quizzes.map(q => {
            const detail = quizDetails.find(d => namesMatch(q.name, d.name));
            if (detail) {
              matchedQuizNames.add(detail.name);
              return {
                ...q,
                openDate: detail.startDate || q.openDate,
                closeDate: detail.endDate || q.closeDate,
                status: determineQuizStatus(detail.startDate, detail.endDate, detail.resultStatus, detail.score),
                score: detail.score || q.score,
                totalMarks: detail.totalMarks || q.totalMarks,
              };
            }
            return q;
          });

          // Add quizzes from activity page that don't match any existing quiz
          quizDetails.forEach((detail) => {
            if (!matchedQuizNames.has(detail.name) && !courseData.quizzes.some(q => namesMatch(q.name, detail.name))) {
              courseData.quizzes.push({
                name: detail.name,
                openDate: detail.startDate,
                closeDate: detail.endDate,
                status: determineQuizStatus(detail.startDate, detail.endDate, detail.resultStatus, detail.score),
                score: detail.score,
                totalMarks: detail.totalMarks,
                eventTarget: '',
                weekNumber: 0,
              });
            }
          });

          console.log('[VULMS AllData] Quiz enrichment:', quizDetails.length, 'from activity page,', courseData.quizzes.length, 'total');
        }
      } catch (e) {
        console.log('[VULMS AllData] Quiz details fetch failed:', e instanceof Error ? e.message : e);
      }

      // ═══ FETCH ASSIGNMENT DETAILS ═══
      try {
        console.log('[VULMS AllData] Fetching assignment details...');
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=Assignment`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const assignUrl = page.url();
        console.log('[VULMS AllData] Assignment page URL:', assignUrl);

        const assignDetails = await page.evaluate(() => {
          const assignments: Array<{ name: string; lesson: string; dueDate: string; totalMarks: string; submitStatus: string; resultStatus: string; score: string }> = [];

          // Use VERIFIED element IDs
          const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterAssignment_Label3_"]');
          console.log('Found assignment title elements:', titleEls.length);

          if (titleEls.length > 0) {
            titleEls.forEach((el, idx) => {
              const title = el.textContent?.trim() || 'Assignment';
              const lessonEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblPayableAmount_${idx}"]`);
              const dueDateEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblDueDate_${idx}"]`);
              const marksEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblTotalMarks_${idx}"]`);
              const statusEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblExpired_${idx}"]`);

              const lesson = lessonEl?.textContent?.trim() || '';
              const statusText = statusEl?.textContent?.trim()?.toLowerCase() || '';

              assignments.push({
                name: lesson ? `${title} - ${lesson}` : title,
                lesson,
                dueDate: dueDateEl?.textContent?.trim() || '',
                totalMarks: marksEl?.textContent?.trim() || '',
                submitStatus: statusText,
                resultStatus: '',
                score: '',
              });
            });
          } else {
            // Fallback: try finding by payable amount (lesson name) elements
            const payableEls = document.querySelectorAll('span[id*="gvTileRepeaterAssignment_lblPayableAmount_"]');
            if (payableEls.length > 0) {
              payableEls.forEach((el, idx) => {
                const lesson = el.textContent?.trim() || '';
                const dueDateEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblDueDate_${idx}"]`);
                const marksEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblTotalMarks_${idx}"]`);
                const statusEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblExpired_${idx}"]`);

                assignments.push({
                  name: lesson ? `Assignment - ${lesson}` : `Assignment ${idx + 1}`,
                  lesson,
                  dueDate: dueDateEl?.textContent?.trim() || '',
                  totalMarks: marksEl?.textContent?.trim() || '',
                  submitStatus: statusEl?.textContent?.trim()?.toLowerCase() || '',
                  resultStatus: '',
                  score: '',
                });
              });
            }
          }

          // Final fallback: parse from body text
          if (assignments.length === 0) {
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes('assignment')) {
                let dueDate = '';
                let totalMarks = '';
                let submitStatus = 'pending';
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                  const dateMatch = lines[j].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i);
                  if (dateMatch && !dueDate) dueDate = lines[j];
                  else if (lines[j].match(/^\d+(?:\.\d+)?$/) && !totalMarks) totalMarks = lines[j];
                  else if (lines[j].toLowerCase().includes('expired')) submitStatus = 'expired';
                  else if (lines[j].toLowerCase().includes('submitted')) submitStatus = 'submitted';
                }
                assignments.push({ name: 'Assignment', lesson: '', dueDate, totalMarks, submitStatus, resultStatus: '', score: '' });
                break;
              }
            }
          }

          return assignments;
        });

        if (assignDetails.length > 0) {
          const matchedAssignNames = new Set<string>();
          courseData.assignments = courseData.assignments.map(a => {
            const detail = assignDetails.find(d => namesMatch(a.name, d.name) || (d.lesson && a.name.toLowerCase().includes(d.lesson.toLowerCase())));
            if (detail) {
              matchedAssignNames.add(detail.name);
              return {
                ...a,
                dueDate: detail.dueDate || a.dueDate,
                status: determineAssignmentStatus(detail.dueDate, detail.submitStatus, detail.resultStatus),
                score: detail.score || a.score,
                totalMarks: detail.totalMarks || a.totalMarks,
              };
            }
            return a;
          });

          assignDetails.forEach((detail) => {
            if (!matchedAssignNames.has(detail.name) && !courseData.assignments.some(a => namesMatch(a.name, detail.name))) {
              courseData.assignments.push({
                name: detail.name,
                dueDate: detail.dueDate,
                status: determineAssignmentStatus(detail.dueDate, detail.submitStatus, detail.resultStatus),
                score: detail.score,
                totalMarks: detail.totalMarks,
                eventTarget: '',
                weekNumber: 0,
              });
            }
          });

          console.log('[VULMS AllData] Assignment enrichment:', assignDetails.length, 'from activity page,', courseData.assignments.length, 'total');
        }
      } catch (e) {
        console.log('[VULMS AllData] Assignment details fetch failed:', e instanceof Error ? e.message : e);
      }

      // ═══ FETCH GDB DETAILS ═══
      try {
        console.log('[VULMS AllData] Fetching GDB details...');
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=GDB`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const gdbUrl = page.url();
        console.log('[VULMS AllData] GDB page URL:', gdbUrl);

        const gdbResult = await page.evaluate(() => {
          const gdbs: Array<{ name: string; openDate: string; closeDate: string; totalMarks: string; gdbStatus: string; submitStatus: string }> = [];

          // Check for "No GDB exists" message
          const noGdbEl = document.querySelector('span[id*="lblmsgTile"]');
          if (noGdbEl && noGdbEl.textContent?.includes('No GDB')) {
            return gdbs; // Return empty array
          }

          const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterGDB_lblTitle_"]');
          if (titleEls.length > 0) {
            titleEls.forEach((el, idx) => {
              const title = el.textContent?.trim() || '';
              const startDateEl = document.querySelector(`span[id*="gvTileRepeaterGDB_Label4_${idx}"]`);
              const endDateEl = document.querySelector(`span[id*="gvTileRepeaterGDB_Label3_${idx}"]`);
              const marksEl = document.querySelector(`span[id*="gvTileRepeaterGDB_Label9_${idx}"]`);
              const statusEl = document.querySelector(`span[id*="gvTileRepeaterGDB_lblStatus_${idx}"]`);
              const submitEl = document.querySelector(`span[id*="gvTileRepeaterGDB_lblSubmissionStatus_${idx}"]`);

              gdbs.push({
                name: title,
                openDate: startDateEl?.textContent?.trim() || '',
                closeDate: endDateEl?.textContent?.trim() || '',
                totalMarks: marksEl?.textContent?.trim() || '',
                gdbStatus: statusEl?.textContent?.trim()?.toLowerCase() || '',
                submitStatus: submitEl?.textContent?.trim()?.toLowerCase() || '',
              });
            });
          }

          // Fallback: parse from body text
          if (gdbs.length === 0) {
            const bodyText = document.body.innerText || '';
            if (!bodyText.toLowerCase().includes('no gdb')) {
              const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('gdb') && !lines[i].toLowerCase().includes('no gdb')) {
                  let openDate = '';
                  let closeDate = '';
                  let totalMarks = '';
                  let gdbStatus = '';
                  let submitStatus = '';
                  for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                    const dateMatch = lines[j].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i);
                    if (dateMatch && !openDate) openDate = lines[j];
                    else if (dateMatch && openDate && !closeDate) closeDate = lines[j];
                    else if (lines[j].match(/^\d+$/) && !totalMarks) totalMarks = lines[j];
                    else if (lines[j].toLowerCase() === 'closed' || lines[j].toLowerCase() === 'open') gdbStatus = lines[j].toLowerCase();
                    else if (lines[j].toLowerCase().includes('submitted') || lines[j].toLowerCase().includes('not submitted')) submitStatus = lines[j].toLowerCase();
                  }
                  const name = lines[i].match(/GDB\s*#?\s*\d+/i)?.[0] || lines[i];
                  gdbs.push({ name, openDate, closeDate, totalMarks, gdbStatus, submitStatus });
                  break;
                }
              }
            }
          }

          return gdbs;
        });

        if (gdbResult.length > 0) {
          const matchedGdbNames = new Set<string>();
          courseData.gdbs = courseData.gdbs.map(g => {
            const detail = gdbResult.find(d => namesMatch(g.name, d.name));
            if (detail) {
              matchedGdbNames.add(detail.name);
              return {
                ...g,
                openDate: detail.openDate || g.openDate,
                closeDate: detail.closeDate || g.closeDate,
                status: detail.gdbStatus === 'closed' ? 'closed' : detail.gdbStatus === 'open' ? 'posted' : 'not_posted',
                totalMarks: detail.totalMarks || g.totalMarks,
                submitStatus: detail.submitStatus || g.submitStatus,
              };
            }
            return g;
          });

          gdbResult.forEach((detail) => {
            if (!matchedGdbNames.has(detail.name) && !courseData.gdbs.some(g => namesMatch(g.name, detail.name))) {
              courseData.gdbs.push({
                name: detail.name,
                openDate: detail.openDate,
                closeDate: detail.closeDate,
                status: detail.gdbStatus === 'closed' ? 'closed' : detail.gdbStatus === 'open' ? 'posted' : 'not_posted',
                totalMarks: detail.totalMarks,
                submitStatus: detail.submitStatus,
                eventTarget: '',
              });
            }
          });

          console.log('[VULMS AllData] GDB enrichment:', gdbResult.length, 'from activity page,', courseData.gdbs.length, 'total');
        }
      } catch (e) {
        console.log('[VULMS AllData] GDB details fetch failed:', e instanceof Error ? e.message : e);
      }

      // ═══ FETCH DOWNLOAD FILES ═══
      // Go back to course page and click Download Files tab
      try {
        console.log('[VULMS AllData] Fetching download files...');
        await page.goto(`${VULMS_BASE}/CourseHome.aspx`, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        // Click Download Files tab
        const downloadTab = await page.$('a[id="DownloadFiles"]');
        if (downloadTab) {
          await downloadTab.click();
          await new Promise(r => setTimeout(r, 3000));

          const downloadFiles = await page.evaluate(() => {
            const files: Array<{ name: string; size: string; url: string }> = [];
            // Parse the download files section from body text
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

            let currentFile = '';
            let currentSize = '';
            for (const line of lines) {
              if (line.toLowerCase().includes('file size:')) {
                currentSize = line.replace(/file size:/i, '').trim();
              } else if (line.startsWith('http') || line.includes('.pdf') || line.includes('.pptx') || line.includes('.zip') || line.includes('.doc')) {
                if (currentFile) {
                  files.push({ name: currentFile, size: currentSize, url: line });
                }
                currentFile = '';
                currentSize = '';
              } else if (line.length > 3 && !line.startsWith('#') && !line.includes('Back') && !line.includes('Download Files') && !line.includes('Learning Management') && !line.includes('Virtual University')) {
                if (!currentFile && line.length < 100) {
                  currentFile = line;
                }
              }
            }

            // Also try to find actual download links
            document.querySelectorAll('a[href*="Download"], a[href*=".pdf"], a[href*=".pptx"], a[href*=".zip"]').forEach((el) => {
              const a = el as HTMLAnchorElement;
              const href = a.href || a.getAttribute('href') || '';
              const name = a.textContent?.trim() || '';
              if (href && !files.some(f => f.url === href)) {
                files.push({ name, size: '', url: href });
              }
            });

            return files;
          });

          // Add download files to handouts
          downloadFiles.forEach(f => {
            if (f.name && !courseData.handouts.some(h => h.name === f.name)) {
              courseData.handouts.push({
                name: f.name,
                url: f.url,
                type: 'download',
                lessonNumber: 0,
                weekNumber: 0,
                status: 'available',
                duration: f.size,
              });
            }
          });

          console.log('[VULMS AllData] Download files found:', downloadFiles.length);
        }
      } catch (e) {
        console.log('[VULMS AllData] Download files fetch failed:', e instanceof Error ? e.message : e);
      }
    }

    // ─── If ALL data is empty, capture debug info ───
    const allEmpty = courseData.handouts.length === 0 && courseData.videos.length === 0
      && courseData.quizzes.length === 0 && courseData.assignments.length === 0
      && courseData.gdbs.length === 0 && courseData.lessons.length === 0;

    if (allEmpty) {
      const debugInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyTextPreview: (document.body.innerText || '').substring(0, 2000),
          allAnchorIds: Array.from(document.querySelectorAll('a[id]')).map(a => ({
            id: a.id,
            text: a.textContent?.trim().substring(0, 60) || '',
            href: a.getAttribute('href')?.substring(0, 80) || '',
          })),
          allDivIds: Array.from(document.querySelectorAll('div[id]')).map(d => d.id).filter(id => id),
        };
      });
      console.log('[VULMS AllData] WARNING: All course data is EMPTY!');
      console.log('[VULMS AllData] Debug - URL:', debugInfo.url, 'Title:', debugInfo.title);
      console.log('[VULMS AllData] Debug - Anchor IDs:', JSON.stringify(debugInfo.allAnchorIds.slice(0, 20)));
      console.log('[VULMS AllData] Debug - Body text:', debugInfo.bodyTextPreview.substring(0, 500));
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

// ─── GET VIDEO LECTURES (on-demand, navigates into each lesson page) ──
// This is SLOW (45 lessons × ~5s = ~4 min) so it's NOT called during initial load
// Call this separately when user wants to see videos
export async function getVideoLectures(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseEventTarget: string
) {
  const { browser, page } = await navigateToCourse(cookies, courseEventTarget);

  try {
    // Get all lesson links from course page
    const lessons = await page.evaluate(() => {
      const results: Array<{ name: string; eventTarget: string; lessonNumber: number }> = [];
      const seen = new Set<string>();
      let count = 0;
      document.querySelectorAll('a[id*="lbtnViewLesson"]').forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.getAttribute('title') || link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const id = link.id || '';
        if (!text || seen.has(id)) return;
        seen.add(id);
        count++;

        let eventTarget = '';
        const doPostBackMatch = href.match(/__doPostBack\('([^']+)'/);
        const webFormMatch = href.match(/WebForm_PostBackOptions\("([^"]+)"/);
        if (doPostBackMatch) eventTarget = doPostBackMatch[1];
        else if (webFormMatch) eventTarget = webFormMatch[1];

        if (eventTarget) {
          results.push({ name: text, eventTarget, lessonNumber: count });
        }
      });
      return results;
    });

    console.log('[VULMS Videos] Found', lessons.length, 'lessons, extracting YouTube links...');

    const videos: VideoLectureInfo[] = [];
    const maxLessons = Math.min(lessons.length, 45);

    for (let i = 0; i < maxLessons; i++) {
      const lesson = lessons[i];

      try {
        // Click into the lesson page
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
          page.evaluate((target) => {
            (window as any).__doPostBack(target, '');
          }, lesson.eventTarget),
        ]);

        await new Promise(r => setTimeout(r, 1500));

        // Check for YouTube iframe
        const videoUrl = await page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="youtube.com/embed/"]') as HTMLIFrameElement;
          if (iframe) {
            const src = iframe.getAttribute('src') || '';
            const m = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
            if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
          }
          return null;
        });

        if (videoUrl) {
          videos.push({
            name: lesson.name,
            youtubeUrl: videoUrl,
            lessonNumber: String(lesson.lessonNumber),
          });
          console.log(`[VULMS Videos] Lesson ${lesson.lessonNumber}: ${lesson.name} -> ${videoUrl.substring(0, 50)}`);
        }

        // Go back to course page
        await page.goBack({ waitUntil: 'networkidle2', timeout: 15000 }).catch(async () => {
          await page.goto(`${VULMS_BASE}/CourseHome.aspx`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        });
        await new Promise(r => setTimeout(r, 1000));

        // Verify we're back on course page
        try {
          await page.waitForSelector('a[id*="lbtnViewLesson"]', { timeout: 5000 });
        } catch {
          console.log('[VULMS Videos] Lost course page context, stopping video extraction');
          break;
        }
      } catch (e) {
        console.log(`[VULMS Videos] Failed lesson ${lesson.lessonNumber}:`, e instanceof Error ? e.message : e);
        await page.goto(`${VULMS_BASE}/CourseHome.aspx`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[VULMS Videos] Extracted ${videos.length} videos from ${maxLessons} lessons`);
    await browser.close();
    return videos;
  } catch (error) {
    await browser.close().catch(() => {});
    console.error('[VULMS Videos] Error:', error instanceof Error ? error.message : error);
    return [];
  }
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
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 45000 });

    if (lessonEventTarget.startsWith('http')) {
      await page.goto(lessonEventTarget, { waitUntil: 'networkidle2', timeout: 45000 });
    } else {
      console.log('[VULMS Content] Opening lesson:', lessonEventTarget);
      // Navigate to course first, then trigger lesson postback
      // First, we need to be on a course page that has this lesson
      // The lessonEventTarget is from the course home page's lesson links
      await page.evaluate((target) => {
        (window as any).__doPostBack(target, '');
      }, lessonEventTarget);

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    }

    // Wait for content to load
    await new Promise(r => setTimeout(r, 2000));

    // Extract content from the lesson page
    const content = await page.evaluate(() => {
      // The lesson content is in an iframe on LessonViewer.aspx
      // Try to get content from the content iframe
      const contentIframe = document.querySelector('iframe[src*="Courses/"]') as HTMLIFrameElement;
      if (contentIframe) {
        try {
          const iframeDoc = contentIframe.contentDocument || contentIframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            return iframeDoc.body.textContent?.trim() || '';
          }
        } catch {
          // Cross-origin iframe - can't access
        }
      }

      // Try multiple content selectors
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
        html: document.body.innerHTML.substring(0, 50000),
        links,
        text: document.body.innerText.substring(0, 10000),
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
