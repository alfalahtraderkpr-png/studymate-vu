// VULMS automation library — Puppeteer-based for Railway/Docker deployment
// Uses real browser to handle reCAPTCHA v3 and ASP.NET WebForms postbacks
//
// VULMS HTML Structure (verified via diagnostic on 2026-05-23):
// - Dashboard (Home.aspx): GridView with ibtnCourseHome links per subject
//   - Subject links: id="MainContent_gvCourseList_ibtnCourseHome_X"
//   - href: javascript:__doPostBack('ctl00$MainContent$gvCourseList$ctl0X$ibtnCourseHome','')
// - Course Home (CourseHome.aspx):
//   - Lesson links: id="MainContent_lstWeeklySchedule_rptIndex_X_lbtnViewLesson_Y"
//     - href: javascript:__doPostBack('ctl00$MainContent$lstWeeklySchedule$ctrlX$rptIndex$ctlYY$lbtnViewLesson','')
//   - Activity links: id="MainContent_lstWeeklySchedule_rptIndex_X_lbtnActivity_Y"
//     - href: javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions("ctl00$MainContent$lstWeeklySchedule$ctrlX$rptIndex$ctlYY$lbtnActivity",""))
//   - NO parent element with id="MainContent_lstWeeklySchedule" — it's a naming container only
//   - Actual parent: id="MainContent_divIndex"
//   - Week containers: id="MainContent_lstWeeklySchedule_rptIndex_X" (these are virtual, actual elements use longer IDs)
//   - Lesson rows: div id="MainContent_lstWeeklySchedule_rptIndex_X_trLesson_Y"
//   - Activity rows: div id="MainContent_lstWeeklySchedule_rptIndex_X_trActivity_Y"
// - Navigation tabs: Index, Course Information, FAQs, Glossary, Books, DownloadFiles, InternetLinks, GradingScheme
// - Activity Calendar (/ActivityCalendar/ActivityCalendar.aspx): Shows ALL activities with dates across subjects
// - Activity pages (/ActivityCalendar/OpenActivitySection.aspx?coursecode=XXX&ActivityType=YYY):
//   - Assignment: Title, Due Date, Total Marks, Submit/Result status
//   - Quiz: Title, Start Date, End Date, Total Marks, Open/Close, Status, Result, Score
//   - GDB: Title, Total Marks, Start Date, End Date, GDB Status, Submit Status
// - Videos are inside individual lesson pages (click lbtnViewLesson → see iframe with YouTube)

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
  courseEventTarget: string,
  subjectCode?: string
) {
  const { browser, page } = await navigateToCourse(cookies, courseEventTarget);

  try {
    console.log('[VULMS AllData] Scraping all course data from Course Home...');

    // ─── SCRAPE LESSONS & ACTIVITIES FROM COURSE HOME ───
    // FIXED: Direct selector on <a> tags — NO parent container with lstWeeklySchedule exists!
    // The correct approach: directly select a[id*="lbtnViewLesson"] and a[id*="lbtnActivity"]
    const courseData = await page.evaluate(() => {
      const result: {
        handouts: Array<{ name: string; url: string; type: string; lessonNumber: number; weekNumber: number; status: string; duration: string }>;
        videos: Array<{ name: string; youtubeUrl: string; lessonNumber: string }>;
        quizzes: Array<{ name: string; openDate: string; closeDate: string; status: string; score: string; totalMarks: string; eventTarget: string; weekNumber: number }>;
        assignments: Array<{ name: string; dueDate: string; status: string; score: string; totalMarks: string; eventTarget: string; weekNumber: number }>;
        gdbs: Array<{ name: string; openDate: string; closeDate: string; status: string; totalMarks: string; submitStatus: string; eventTarget: string }>;
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
      let lessonCount = 0;

      // ── LESSON LINKS: a[id*="lbtnViewLesson"] ──
      const lessonLinks = document.querySelectorAll('a[id*="lbtnViewLesson"]');
      lessonLinks.forEach((el) => {
        const link = el as HTMLAnchorElement;
        const text = link.getAttribute('title') || link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const id = link.id || '';

        if (!text || seen.has('lesson:' + id)) return;
        seen.add('lesson:' + id);

        lessonCount++;

        // Extract eventTarget from __doPostBack
        const match = href.match(/__doPostBack\('([^']+)'/);
        const eventTarget = match ? match[1] : '';

        // Extract week number from ID: MainContent_lstWeeklySchedule_rptIndex_X_lbtnViewLesson_Y
        const weekMatch = id.match(/rptIndex_(\d+)/);
        const weekNumber = weekMatch ? parseInt(weekMatch[1]) + 1 : 0;

        // Get lesson status and duration from parent/sibling elements
        const parentDiv = link.closest('div[id*="trLesson"]');
        let status = 'closed';
        let duration = '';
        if (parentDiv) {
          const parentText = parentDiv.textContent?.toLowerCase() || '';
          status = parentText.includes('open') ? 'open' : 'closed';
          // Try to get duration from sibling spans
          const durationSpan = parentDiv.querySelector('span[id*="lblLessonDuration"]');
          if (durationSpan) {
            duration = durationSpan.textContent?.trim() || '';
          }
        }

        if (eventTarget) {
          result.lessons.push({
            name: text,
            eventTarget,
            lessonNumber: lessonCount,
            weekNumber,
            status,
          });

          // Each lesson IS a handout in VULMS
          result.handouts.push({
            name: text,
            url: eventTarget,
            type: 'lesson',
            lessonNumber: lessonCount,
            weekNumber,
            status,
            duration,
          });
        }
      });

      // ── ACTIVITY LINKS: a[id*="lbtnActivity"] ──
      const activityLinks = document.querySelectorAll('a[id*="lbtnActivity"]');
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

        // Extract week number from ID
        const weekMatch = id.match(/rptIndex_(\d+)/);
        const weekNumber = weekMatch ? parseInt(weekMatch[1]) + 1 : 0;

        // Get activity status from parent div
        const parentDiv = link.closest('div[id*="trActivity"]');
        let activityStatus = '';
        if (parentDiv) {
          const parentText = parentDiv.textContent?.trim() || '';
          // Look for status text like "Open", "Closed", "Expired"
          const statusMatch = parentText.match(/(Open|Closed|Expired|Not Started)/i);
          activityStatus = statusMatch ? statusMatch[1].toLowerCase() : '';
        }

        const lowerText = text.toLowerCase();

        if (lowerText.includes('quiz')) {
          result.quizzes.push({
            name: text,
            openDate: '',
            closeDate: '',
            status: activityStatus === 'open' ? 'in_progress' : 'not_started',
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

      // ── CHECK FOR YOUTUBE/VIDEO LINKS ON COURSE HOME ──
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

    console.log('[VULMS AllData] Course Home results:', {
      handouts: courseData.handouts.length,
      videos: courseData.videos.length,
      quizzes: courseData.quizzes.length,
      assignments: courseData.assignments.length,
      gdbs: courseData.gdbs.length,
      lessons: courseData.lessons.length,
    });

    // ─── ENRICH WITH ACTIVITY CALENDAR DATA (dates, scores, etc.) ───
    if (subjectCode) {
      console.log('[VULMS AllData] Fetching activity details for', subjectCode);

      // ── Helper: determine quiz status from dates ──
      const determineQuizStatus = (startDate: string, endDate: string, resultStatus: string, score: string): 'completed' | 'not_started' | 'in_progress' | 'expired' => {
        if (resultStatus === 'declared' || score) return 'completed';
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
        if (submitStatus === 'submitted' || resultStatus === 'declared') {
          return resultStatus === 'declared' ? 'graded' : 'submitted';
        }
        if (submitStatus === 'expired') return 'overdue';
        if (dueDate) {
          try {
            if (new Date() > new Date(dueDate)) return 'overdue';
          } catch { /* fall through */ }
        }
        return 'not_submitted';
      };

      // ── Helper: name matching (handles "Quiz 01" == "Quiz 1", "Assignment#1" == "Assignment 1") ──
      const namesMatch = (a: string, b: string): boolean => {
        // Normalize: lowercase, remove special chars, strip leading zeros from numbers
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/0+(\d+)/g, '$1');
        const na = normalize(a);
        const nb = normalize(b);
        return na === nb || na.includes(nb) || nb.includes(na);
      };

      // Fetch Quiz details
      try {
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=QuizList`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        // Use specific element IDs for quiz page: gvTileRepeaterQuiz_lblTitle_X, lblStartDate_X, lblEndDate_X, lblStatus_X, lblSubmitted_X
        const quizDetails = await page.evaluate(() => {
          const quizzes: Array<{ name: string; startDate: string; endDate: string; totalMarks: string; status: string; resultStatus: string; score: string }> = [];

          // Find all quiz title elements to determine how many quizzes exist
          const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterQuiz_lblTitle_"]');
          titleEls.forEach((el, idx) => {
            const title = el.textContent?.trim() || '';
            const startDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStartDate_${idx}"]`);
            const endDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblEndDate_${idx}"]`);
            const statusEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStatus_${idx}"]`);
            const submittedEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblSubmitted_${idx}"]`);
            // Total marks might be in a sibling or nearby element - try multiple selectors
            const marksEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_Label5_${idx}"], span[id*="gvTileRepeaterQuiz_lblTotalMarks_${idx}"]`);
            // If standard marks element not found, look for the number between labels
            let marks = marksEl?.textContent?.trim() || '';
            if (!marks || marks.includes(':')) {
              // Try finding it from the parent container text
              const container = el.closest('div, li');
              if (container) {
                const containerText = container.textContent || '';
                // Find the number that appears between endDate and status
                const marksMatch = containerText.match(/(\d+(?:\.\d+)?)\s*(?:Closed|Open|Result)/);
                marks = marksMatch ? marksMatch[1] : '';
              }
            }

            if (title) {
              quizzes.push({
                name: title,
                startDate: startDateEl?.textContent?.trim() || '',
                endDate: endDateEl?.textContent?.trim() || '',
                totalMarks: marks,
                status: statusEl?.textContent?.trim()?.toLowerCase() || '',
                resultStatus: submittedEl?.textContent?.trim()?.toLowerCase() || '',
                score: '', // Score is typically shown in Result column
              });
            }
          });

          // Fallback: if no structured elements found, parse from body text
          if (quizzes.length === 0) {
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
            let inQuizSection = false;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.match(/Quiz\s*#?\s*\d+/i)) {
                inQuizSection = true;
                const name = line.match(/Quiz\s*#?\s*\d+/i)?.[0] || line;
                // Look for date patterns in next lines
                let startDate = '';
                let endDate = '';
                let totalMarks = '';
                let status = '';
                let resultStatus = '';
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                  const dateMatch = lines[j].match(/(\w{3,9}\s+\d{1,2},?\s+\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))?/);
                  if (dateMatch && !startDate) startDate = lines[j];
                  else if (dateMatch && startDate && !endDate) endDate = lines[j];
                  else if (lines[j].match(/^\d+(?:\.\d+)?$/) && !totalMarks) totalMarks = lines[j];
                  else if (lines[j].toLowerCase() === 'closed' || lines[j].toLowerCase() === 'open') status = lines[j].toLowerCase();
                  else if (lines[j].toLowerCase().includes('result')) resultStatus = lines[j].toLowerCase();
                  else if (lines[j].match(/^\d+$/) && totalMarks) { /* could be score */ }
                }
                quizzes.push({ name, startDate, endDate, totalMarks, status, resultStatus, score: '' });
              }
            }
          }

          return quizzes;
        });

        if (quizDetails.length > 0) {
          // Merge matching quizzes with dates
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

          // ADD quizzes from activity page that don't match any existing quiz
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

      // Fetch Assignment details
      try {
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=Assignment`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        // Use specific element IDs: gvTileRepeaterAssignment_lblDueDate_X, lblTotalMarks_X, lblExpired_X, lblPayableAmount_X (lesson)
        const assignDetails = await page.evaluate(() => {
          const assignments: Array<{ name: string; lesson: string; dueDate: string; totalMarks: string; submitStatus: string; resultStatus: string; score: string }> = [];

          const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterAssignment_lblPayableAmount_"]');
          if (titleEls.length > 0) {
            titleEls.forEach((el, idx) => {
              const lesson = el.textContent?.trim() || '';
              const dueDateEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblDueDate_${idx}"]`);
              const marksEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblTotalMarks_${idx}"]`);
              const statusEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblExpired_${idx}"]`);

              // The title is usually "Assignment" with a lesson number
              const titleEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_Label3_${idx}"]`);
              const title = titleEl?.textContent?.trim() || 'Assignment';
              const statusText = statusEl?.textContent?.trim()?.toLowerCase() || '';

              assignments.push({
                name: `${title} - ${lesson}` || `Assignment ${idx + 1}`,
                lesson,
                dueDate: dueDateEl?.textContent?.trim() || '',
                totalMarks: marksEl?.textContent?.trim() || '',
                submitStatus: statusText.includes('submitted') ? 'submitted' : statusText.includes('expired') ? 'expired' : 'pending',
                resultStatus: statusText.includes('result') ? 'declared' : '',
                score: '',
              });
            });
          } else {
            // Fallback: parse from body text
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes('assignment')) {
                let dueDate = '';
                let totalMarks = '';
                let submitStatus = 'pending';
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                  if (lines[j].match(/\w{3,9}\s+\d{1,2},?\s+\d{4}/) && !dueDate) dueDate = lines[j];
                  else if (lines[j].match(/^\d+(?:\.\d+)?$/) && !totalMarks) totalMarks = lines[j];
                  else if (lines[j].toLowerCase().includes('expired')) submitStatus = 'expired';
                  else if (lines[j].toLowerCase().includes('submitted')) submitStatus = 'submitted';
                }
                assignments.push({ name: `Assignment`, lesson: '', dueDate, totalMarks, submitStatus, resultStatus: '', score: '' });
                break; // Only first assignment on fallback
              }
            }
          }

          return assignments;
        });

        if (assignDetails.length > 0) {
          const matchedAssignNames = new Set<string>();
          courseData.assignments = courseData.assignments.map(a => {
            const detail = assignDetails.find(d => namesMatch(a.name, d.name));
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

          // ADD assignments from activity page that don't match any existing
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

      // Fetch GDB details
      try {
        await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${subjectCode}&ActivityType=GDB`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        // Use specific element IDs: gvTileRepeaterGDB_lblTitle_X, lblStatus_X, lblSubmissionStatus_X, Label4_X (start date), Label3_X (end date), Label9_X (marks)
        const gdbResult = await page.evaluate(() => {
          const gdbs: Array<{ name: string; openDate: string; closeDate: string; totalMarks: string; gdbStatus: string; submitStatus: string }> = [];

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
          } else {
            // Fallback: parse from body text
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes('gdb')) {
                let openDate = '';
                let closeDate = '';
                let totalMarks = '';
                let gdbStatus = '';
                let submitStatus = '';
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                  if (lines[j].match(/\w{3,9}\s+\d{1,2},?\s+\d{4}/) && !openDate) openDate = lines[j];
                  else if (lines[j].match(/\w{3,9}\s+\d{1,2},?\s+\d{4}/) && openDate && !closeDate) closeDate = lines[j];
                  else if (lines[j].match(/^\d+$/) && !totalMarks) totalMarks = lines[j];
                  else if (lines[j].toLowerCase() === 'closed' || lines[j].toLowerCase() === 'open') gdbStatus = lines[j].toLowerCase();
                  else if (lines[j].toLowerCase().includes('submitted') || lines[j].toLowerCase().includes('not submitted')) submitStatus = lines[j].toLowerCase();
                }
                const name = lines[i].match(/GDB\s*#?\s*\d+/i)?.[0] || lines[i];
                gdbs.push({ name, openDate, closeDate, totalMarks, gdbStatus, submitStatus });
                break; // Only first GDB on fallback
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

          // ADD GDBs from activity page that don't match any existing
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
