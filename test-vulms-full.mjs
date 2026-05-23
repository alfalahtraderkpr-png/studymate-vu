// Comprehensive VULMS diagnostic test - runs full login + course data fetch
import puppeteer from 'puppeteer';

const VULMS_BASE = 'https://vulms.vu.edu.pk';
const STUDENT_ID = 'BC240404472';
const PASSWORD = '@Bilal@123';

const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--window-size=1280,720',
  '--disable-blink-features=AutomationControlled',
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== STEP 1: LOGIN ===');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: BROWSER_ARGS,
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en','ur'] });
    window.chrome = { runtime: {} };
  });

  try {
    // LOGIN
    await page.goto(VULMS_BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#txtStudentID', { timeout: 15000 });
    
    // Wait for reCAPTCHA
    await page.waitForFunction(() => {
      const f = document.querySelector('#g-recaptcha-response');
      return f && f.value && f.value.length > 10;
    }, { timeout: 15000 }).catch(() => console.log('No reCAPTCHA token, proceeding...'));
    
    await sleep(500 + Math.random() * 1000);
    
    await page.click('#txtStudentID', { clickCount: 3 });
    await page.type('#txtStudentID', STUDENT_ID, { delay: 50 });
    await sleep(300);
    
    await page.click('#txtPassword', { clickCount: 3 });
    await page.type('#txtPassword', PASSWORD, { delay: 50 });
    await sleep(500 + Math.random() * 1000);
    
    await Promise.all([
      page.click('#ibtnLogin'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(async () => {
      await page.evaluate(() => { const f = document.querySelector('#ctl00'); if(f) f.submit(); });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    });
    
    const loginUrl = page.url();
    const loginContent = await page.content();
    const stillOnLogin = loginContent.includes('txtStudentID') && loginContent.includes('txtPassword');
    
    if (stillOnLogin) {
      const err = await page.evaluate(() => document.querySelector('#lblError')?.textContent?.trim() || '');
      console.log('LOGIN FAILED:', err);
      await browser.close();
      return;
    }
    
    console.log('LOGIN SUCCESS! URL:', loginUrl);
    
    // Get cookies
    const cookies = await page.cookies();
    console.log('Cookies count:', cookies.length);
    
    // Navigate to Home.aspx if not already
    if (!loginUrl.toLowerCase().includes('home.aspx') && !loginUrl.toLowerCase().includes('coursehome')) {
      await page.goto(VULMS_BASE + '/Home.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    }
    
    // SCRAPE SUBJECTS
    console.log('\n=== STEP 2: SCRAPE SUBJECTS ===');
    const subjects = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      document.querySelectorAll('a[id*="ibtnCourseHome"]').forEach(el => {
        const link = el;
        const text = link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const codeMatch = text.match(/([A-Z]{2,5}\d{3}[A-Z]?)/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : '';
        if (!code || code.length < 4 || seen.has(code)) return;
        seen.add(code);
        const match = href.match(/__doPostBack\('([^']+)'/);
        const eventTarget = match ? match[1] : '';
        if (eventTarget) results.push({ name: text.split(/\s{2,}/)[0] || text, code, eventTarget });
      });
      return results;
    });
    
    console.log('Found subjects:', subjects.length);
    subjects.forEach(s => console.log(`  - ${s.code}: ${s.name} => ${s.eventTarget}`));
    
    if (subjects.length === 0) {
      console.log('No subjects found! Dumping page HTML (first 3000 chars):');
      const html = await page.content();
      console.log(html.substring(0, 3000));
      await browser.close();
      return;
    }
    
    // TEST FIRST SUBJECT - Navigate and scrape course data
    const testSubject = subjects[0];
    console.log(`\n=== STEP 3: NAVIGATE TO COURSE ${testSubject.code} ===`);
    
    // Do postback to navigate to course
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.evaluate((target) => { window.__doPostBack(target, ''); }, testSubject.eventTarget),
      ]);
    } catch (e) {
      console.log('Promise.all postback failed, trying sequential...');
      await page.evaluate((target) => { window.__doPostBack(target, ''); }, testSubject.eventTarget);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    }
    
    await sleep(2000);
    const courseUrl = page.url();
    console.log('After postback URL:', courseUrl);
    
    // Check if we're on dashboard still
    const isOnDashboard = (url) => {
      const path = new URL(url).pathname.toLowerCase();
      return path === '/home.aspx' || path === '/';
    };
    
    if (isOnDashboard(courseUrl)) {
      console.log('STILL ON DASHBOARD! Trying direct click...');
      const link = await page.$(`a[id*="ibtnCourseHome"]`);
      if (link) {
        await Promise.all([link.click(), page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })]).catch(() => {});
        await sleep(2000);
        console.log('After click URL:', page.url());
      }
    }
    
    // Wait for lesson links
    try {
      await page.waitForSelector('a[id*="lbtnViewLesson"]', { timeout: 8000 });
      console.log('Lesson links found!');
    } catch {
      console.log('WARNING: No lesson links found after navigation');
    }
    
    const finalCourseUrl = page.url();
    console.log('Final course URL:', finalCourseUrl);
    
    // SCRAPE LESSON LINKS (handouts)
    console.log('\n=== STEP 4: SCRAPE COURSE DATA ===');
    const courseData = await page.evaluate(() => {
      const handouts = [];
      const quizzes = [];
      const assignments = [];
      
      // Lesson links = handouts
      const lessonLinks = document.querySelectorAll('a[id*="lbtnViewLesson"]');
      console.log('Lesson links found:', lessonLinks.length);
      
      lessonLinks.forEach((el, i) => {
        const link = el;
        const text = link.getAttribute('title') || link.textContent?.trim().replace(/\s+/g, ' ') || '';
        const href = link.getAttribute('href') || '';
        const id = link.id || '';
        
        let eventTarget = '';
        const match1 = href.match(/__doPostBack\('([^']+)'/);
        const match2 = href.match(/WebForm_PostBackOptions\("([^"]+)"/);
        if (match1) eventTarget = match1[1];
        else if (match2) eventTarget = match2[1];
        
        if (i < 5) console.log(`  Lesson ${i+1}: "${text}" href="${href.substring(0,60)}..." eventTarget="${eventTarget}"`);
        
        handouts.push({ name: text, eventTarget });
      });
      
      // Activity links = quizzes/assignments
      const activityLinks = document.querySelectorAll('a[id*="lbtnActivity"]');
      console.log('Activity links found:', activityLinks.length);
      
      activityLinks.forEach((el, i) => {
        const link = el;
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        
        let eventTarget = '';
        const match1 = href.match(/__doPostBack\('([^']+)'/);
        const match2 = href.match(/WebForm_PostBackOptions\("([^"]+)"/);
        if (match1) eventTarget = match1[1];
        else if (match2) eventTarget = match2[1];
        
        if (i < 5) console.log(`  Activity ${i+1}: "${text}" eventTarget="${eventTarget}"`);
        
        const lowerText = text.toLowerCase();
        if (lowerText.includes('quiz')) quizzes.push({ name: text, eventTarget });
        else if (lowerText.includes('assignment') || lowerText.includes('assign')) assignments.push({ name: text, eventTarget });
      });
      
      return { handouts, quizzes, assignments };
    });
    
    console.log('\nCourse Data Results:');
    console.log(`  Handouts: ${courseData.handouts.length}`);
    courseData.handouts.slice(0, 5).forEach(h => console.log(`    - "${h.name}" eventTarget="${h.eventTarget}"`));
    console.log(`  Quizzes: ${courseData.quizzes.length}`);
    courseData.quizzes.slice(0, 5).forEach(q => console.log(`    - "${q.name}" eventTarget="${q.eventTarget}"`));
    console.log(`  Assignments: ${courseData.assignments.length}`);
    courseData.assignments.slice(0, 5).forEach(a => console.log(`    - "${a.name}" eventTarget="${a.eventTarget}"`));
    
    // TEST QUIZ DETAILS PAGE
    console.log(`\n=== STEP 5: FETCH QUIZ DETAILS ===`);
    try {
      await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${testSubject.code}&ActivityType=QuizList`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
      console.log('Quiz page URL:', page.url());
      
      const quizDetails = await page.evaluate(() => {
        const quizzes = [];
        
        // Try VERIFIED selectors
        const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterQuiz_lblTitle_"]');
        console.log('Quiz title elements found:', titleEls.length);
        
        if (titleEls.length > 0) {
          titleEls.forEach((el, idx) => {
            const title = el.textContent?.trim() || '';
            const startDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStartDate_${idx}"]`);
            const endDateEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblEndDate_${idx}"]`);
            const statusEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblStatus_${idx}"]`);
            const marksEl = document.querySelector(`span[id*="gvTileRepeaterQuiz_lblTotalMarks_${idx}"]`);
            
            quizzes.push({
              title,
              startDate: startDateEl?.textContent?.trim() || '',
              endDate: endDateEl?.textContent?.trim() || '',
              status: statusEl?.textContent?.trim() || '',
              totalMarks: marksEl?.textContent?.trim() || '',
            });
          });
        }
        
        // If no structured elements, dump page text snippet
        if (quizzes.length === 0) {
          const bodyText = document.body.innerText || '';
          // Find quiz-related lines
          const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
          const quizLines = lines.filter(l => l.toLowerCase().includes('quiz') || l.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/));
          console.log('Quiz-related text lines (first 20):', quizLines.slice(0, 20));
        }
        
        return quizzes;
      });
      
      console.log('Quiz details:', JSON.stringify(quizDetails, null, 2));
    } catch (e) {
      console.log('Quiz fetch failed:', e.message);
    }
    
    // TEST ASSIGNMENT DETAILS PAGE
    console.log(`\n=== STEP 6: FETCH ASSIGNMENT DETAILS ===`);
    try {
      await page.goto(`${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=${testSubject.code}&ActivityType=Assignment`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
      console.log('Assignment page URL:', page.url());
      
      const assignDetails = await page.evaluate(() => {
        const assignments = [];
        
        // Try VERIFIED selectors
        const titleEls = document.querySelectorAll('span[id*="gvTileRepeaterAssignment_Label3_"]');
        const payableEls = document.querySelectorAll('span[id*="gvTileRepeaterAssignment_lblPayableAmount_"]');
        console.log('Assignment title elements:', titleEls.length, 'payable elements:', payableEls.length);
        
        if (titleEls.length > 0) {
          titleEls.forEach((el, idx) => {
            const title = el.textContent?.trim() || 'Assignment';
            const lessonEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblPayableAmount_${idx}"]`);
            const dueDateEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblDueDate_${idx}"]`);
            const marksEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblTotalMarks_${idx}"]`);
            const statusEl = document.querySelector(`span[id*="gvTileRepeaterAssignment_lblExpired_${idx}"]`);
            
            assignments.push({
              title,
              lesson: lessonEl?.textContent?.trim() || '',
              dueDate: dueDateEl?.textContent?.trim() || '',
              totalMarks: marksEl?.textContent?.trim() || '',
              status: statusEl?.textContent?.trim() || '',
            });
          });
        }
        
        if (assignments.length === 0) {
          const bodyText = document.body.innerText || '';
          const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
          const assignLines = lines.filter(l => l.toLowerCase().includes('assignment') || l.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/));
          console.log('Assignment-related text lines (first 20):', assignLines.slice(0, 20));
        }
        
        return assignments;
      });
      
      console.log('Assignment details:', JSON.stringify(assignDetails, null, 2));
    } catch (e) {
      console.log('Assignment fetch failed:', e.message);
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close().catch(() => {});
  }
}

main();
