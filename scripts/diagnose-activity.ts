// Diagnostic script to examine VULMS Activity Calendar and Download Files pages
// Run: npx tsx scripts/diagnose-activity.ts

const puppeteer = require('puppeteer');

const STUDENT_ID = 'BC240404472';
const PASSWORD = '@Bilal@123';
const VULMS_BASE = 'https://vulms.vu.edu.pk';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/home/z/my-project/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as any).chrome = { runtime: {} };
  });

  // ═══ LOGIN ═══
  console.log('=== STEP 1: Login ===');
  await page.goto(VULMS_BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('#txtStudentID', { timeout: 15000 });

  await page.waitForFunction(() => {
    const field = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
    return field && field.value && field.value.length > 10;
  }, { timeout: 15000 }).catch(() => console.log('reCAPTCHA not found'));

  await new Promise(r => setTimeout(r, 1000));

  await page.click('#txtStudentID', { clickCount: 3 });
  await page.type('#txtStudentID', STUDENT_ID, { delay: 50 });
  await page.click('#txtPassword', { clickCount: 3 });
  await page.type('#txtPassword', PASSWORD, { delay: 50 });
  await new Promise(r => setTimeout(r, 1000));

  await Promise.all([
    page.click('#ibtnLogin'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
  ]).catch(async () => {
    await page.evaluate(() => { (document.querySelector('#ctl00') as HTMLFormElement).submit(); });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  });

  const loginUrl = page.url();
  const loginContent = await page.content();
  if (loginContent.includes('txtStudentID') && loginContent.includes('txtPassword')) {
    console.log('LOGIN FAILED!');
    await browser.close();
    return;
  }
  console.log('LOGIN SUCCESS! URL:', loginUrl);

  if (!loginUrl.toLowerCase().includes('home.aspx')) {
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  // ═══ TEST: Activity Calendar Quiz Page for ECO402 ═══
  console.log('\n=== STEP 2: Quiz Activity Page (ECO402) ===');
  const quizUrl = `${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=ECO402&ActivityType=QuizList`;
  await page.goto(quizUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const quizData = await page.evaluate(() => {
    const result: {
      url: string;
      title: string;
      bodyText: string;
      spans: Array<{id: string; text: string}>;
      divs: Array<{id: string; className: string}>;
      links: Array<{id: string; text: string; href: string}>;
      tables: Array<{id: string; rows: number; headers: string}>;
    } = {
      url: window.location.href,
      title: document.title,
      bodyText: (document.body.innerText || '').substring(0, 3000),
      spans: [],
      divs: [],
      links: [],
      tables: [],
    };

    document.querySelectorAll('span[id]').forEach((el) => {
      const s = el as HTMLSpanElement;
      const t = s.textContent?.trim() || '';
      if (t) result.spans.push({ id: s.id, text: t.substring(0, 100) });
    });

    document.querySelectorAll('div[id]').forEach((el) => {
      const d = el as HTMLDivElement;
      if (d.id) result.divs.push({ id: d.id, className: d.className?.substring(0, 60) || '' });
    });

    document.querySelectorAll('a').forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim().substring(0, 80) || '';
      const href = a.getAttribute('href') || '';
      if (text || a.id) result.links.push({ id: a.id || '', text, href: href.substring(0, 120) });
    });

    document.querySelectorAll('table').forEach((el) => {
      const t = el as HTMLTableElement;
      const headers: string[] = [];
      t.querySelectorAll('th').forEach(th => headers.push(th.textContent?.trim() || ''));
      result.tables.push({ id: t.id || '', rows: t.rows.length, headers: headers.join(', ') });
    });

    return result;
  });

  console.log('Quiz Page URL:', quizData.url);
  console.log('Quiz Page Title:', quizData.title);
  console.log('Quiz Page Spans:', quizData.spans.length);
  quizData.spans.slice(0, 40).forEach(s => console.log(`  [${s.id}] "${s.text}"`));
  console.log('Quiz Page Tables:', quizData.tables.length);
  quizData.tables.forEach(t => console.log(`  [${t.id}] ${t.rows} rows, headers: ${t.headers}`));
  console.log('\nQuiz Body Text:');
  console.log(quizData.bodyText.substring(0, 1500));

  // ═══ TEST: Assignment Activity Page for ECO402 ═══
  console.log('\n=== STEP 3: Assignment Activity Page (ECO402) ===');
  const assignUrl = `${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=ECO402&ActivityType=Assignment`;
  await page.goto(assignUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const assignData = await page.evaluate(() => {
    const spans: Array<{id: string; text: string}> = [];
    document.querySelectorAll('span[id]').forEach((el) => {
      const s = el as HTMLSpanElement;
      const t = s.textContent?.trim() || '';
      if (t) spans.push({ id: s.id, text: t.substring(0, 100) });
    });
    return {
      url: window.location.href,
      title: document.title,
      bodyText: (document.body.innerText || '').substring(0, 2000),
      spans,
      tables: Array.from(document.querySelectorAll('table')).map(t => ({
        id: (t as HTMLTableElement).id || '',
        rows: (t as HTMLTableElement).rows.length,
      })),
    };
  });

  console.log('Assignment Page URL:', assignData.url);
  console.log('Assignment Page Spans:', assignData.spans.length);
  assignData.spans.slice(0, 30).forEach(s => console.log(`  [${s.id}] "${s.text}"`));
  console.log('Assignment Body Text:');
  console.log(assignData.bodyText.substring(0, 1000));

  // ═══ TEST: GDB Activity Page for ECO402 ═══
  console.log('\n=== STEP 4: GDB Activity Page (ECO402) ===');
  const gdbUrl = `${VULMS_BASE}/ActivityCalendar/OpenActivitySection.aspx?coursecode=ECO402&ActivityType=GDB`;
  await page.goto(gdbUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const gdbData = await page.evaluate(() => {
    const spans: Array<{id: string; text: string}> = [];
    document.querySelectorAll('span[id]').forEach((el) => {
      const s = el as HTMLSpanElement;
      const t = s.textContent?.trim() || '';
      if (t) spans.push({ id: s.id, text: t.substring(0, 100) });
    });
    return {
      url: window.location.href,
      bodyText: (document.body.innerText || '').substring(0, 2000),
      spans,
    };
  });

  console.log('GDB Page URL:', gdbData.url);
  console.log('GDB Page Spans:', gdbData.spans.length);
  gdbData.spans.slice(0, 30).forEach(s => console.log(`  [${s.id}] "${s.text}"`));
  console.log('GDB Body Text:');
  console.log(gdbData.bodyText.substring(0, 1000));

  // ═══ TEST: Navigate to Course and click Download Files tab ═══
  console.log('\n=== STEP 5: Course Home - Download Files Tab (ECO402) ===');
  await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // Click on ECO402 course link
  const courseLink = await page.$('a[id*="ibtnCourseHome"]');
  if (courseLink) {
    await Promise.all([
      courseLink.click(),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(() => {});
  }
  await new Promise(r => setTimeout(r, 3000));

  console.log('Course page URL:', page.url());

  // Click "Download Files" tab
  const downloadTab = await page.$('a[id="DownloadFiles"]');
  if (downloadTab) {
    console.log('Found Download Files tab, clicking...');
    await downloadTab.click();
    await new Promise(r => setTimeout(r, 3000));

    const downloadData = await page.evaluate(() => {
      const files: Array<{name: string; href: string; id: string; size: string}> = [];
      // Look for downloadable file links
      document.querySelectorAll('a[href*="Download"], a[href*=".pdf"], a[href*=".pptx"], a[href*=".zip"], a[href*="ContentFile"], a[href*="Handout"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        files.push({
          name: a.textContent?.trim().substring(0, 80) || '',
          href: a.href || a.getAttribute('href') || '',
          id: a.id || '',
          size: '',
        });
      });

      // Also check for any file list/table
      const allSpans: Array<{id: string; text: string}> = [];
      document.querySelectorAll('span[id]').forEach((el) => {
        const s = el as HTMLSpanElement;
        const t = s.textContent?.trim() || '';
        if (t && (t.includes('Lesson') || t.includes('.pdf') || t.includes('.pptx') || t.includes('Download') || t.includes('Handout'))) {
          allSpans.push({ id: s.id, text: t.substring(0, 100) });
        }
      });

      return {
        files,
        spans: allSpans,
        bodyText: (document.body.innerText || '').substring(0, 2000),
      };
    });

    console.log('Download Files - File links:', downloadData.files.length);
    downloadData.files.forEach(f => console.log(`  [${f.id}] "${f.name}" | ${f.href.substring(0, 100)}`));
    console.log('Download Files - Relevant spans:', downloadData.spans.length);
    downloadData.spans.forEach(s => console.log(`  [${s.id}] "${s.text}"`));
    console.log('Download Body Text:');
    console.log(downloadData.bodyText.substring(0, 1500));
  } else {
    console.log('Download Files tab NOT found! Checking all tabs...');
    const tabs = await page.evaluate(() => {
      const tabs: Array<{id: string; text: string; href: string}> = [];
      document.querySelectorAll('[id]').forEach((el) => {
        const text = el.textContent?.trim().substring(0, 50) || '';
        const id = el.id || '';
        if (id && (text.includes('Download') || text.includes('Files') || text.includes('Book') || text.includes('Index'))) {
          tabs.push({ id, text, href: (el as HTMLAnchorElement).getAttribute('href') || '' });
        }
      });
      return tabs;
    });
    tabs.forEach(t => console.log(`  [${t.id}] "${t.text}" | ${t.href}`));
  }

  // ═══ TEST: Internet Links tab for YouTube videos ═══
  console.log('\n=== STEP 6: Course Home - Internet Links Tab (ECO402) ===');
  const internetTab = await page.$('a[id="InternetLinks"]');
  if (internetTab) {
    console.log('Found Internet Links tab, clicking...');
    await internetTab.click();
    await new Promise(r => setTimeout(r, 3000));

    const videoData = await page.evaluate(() => {
      const videos: Array<{name: string; href: string; id: string}> = [];
      document.querySelectorAll('a[href*="youtube"], a[href*="youtu.be"], iframe[src*="youtube"]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        const href = a.href || a.getAttribute('src') || a.getAttribute('href') || '';
        const name = a.textContent?.trim().substring(0, 80) || '';
        videos.push({ name, href: href.substring(0, 150), id: a.id || '' });
      });

      const allSpans: Array<{id: string; text: string}> = [];
      document.querySelectorAll('span[id]').forEach((el) => {
        const s = el as HTMLSpanElement;
        const t = s.textContent?.trim() || '';
        if (t) allSpans.push({ id: s.id, text: t.substring(0, 100) });
      });

      return {
        videos,
        spans: allSpans.slice(0, 50),
        bodyText: (document.body.innerText || '').substring(0, 2000),
      };
    });

    console.log('Internet Links - Video links:', videoData.videos.length);
    videoData.videos.forEach(v => console.log(`  [${v.id}] "${v.name}" | ${v.href}`));
    console.log('Internet Links - Spans:', videoData.spans.length);
    videoData.spans.forEach(s => console.log(`  [${s.id}] "${s.text}"`));
    console.log('Internet Links Body Text:');
    console.log(videoData.bodyText.substring(0, 1000));
  }

  // ═══ TEST: Go into a lesson page to check for YouTube iframe ═══
  console.log('\n=== STEP 7: Click into a Lesson to check for YouTube iframe ===');
  // Go back to Index tab first
  const indexTab = await page.$('a[id="Index"]');
  if (indexTab) {
    await indexTab.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Click first lesson
  const firstLesson = await page.$('a[id*="lbtnViewLesson"]');
  if (firstLesson) {
    const lessonText = await page.evaluate((el: Element) => el.textContent?.trim(), firstLesson);
    console.log('Clicking lesson:', lessonText);

    await Promise.all([
      firstLesson.click(),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const lessonData = await page.evaluate(() => {
      const iframes: Array<{src: string; id: string}> = [];
      document.querySelectorAll('iframe').forEach((el) => {
        iframes.push({ src: el.getAttribute('src') || '', id: el.id || '' });
      });

      return {
        url: window.location.href,
        title: document.title,
        iframes,
        bodyText: (document.body.innerText || '').substring(0, 1500),
        mainContent: (() => {
          const main = document.querySelector('#MainContent') || document.querySelector('.m-portlet__body') || document.querySelector('#divLessonContent');
          return main ? main.textContent?.trim().substring(0, 500) : '';
        })(),
      };
    });

    console.log('Lesson Page URL:', lessonData.url);
    console.log('Lesson Page Title:', lessonData.title);
    console.log('Lesson Iframes:', lessonData.iframes.length);
    lessonData.iframes.forEach(f => console.log(`  [${f.id}] src: ${f.src}`));
    console.log('Lesson Main Content:', lessonData.mainContent?.substring(0, 300));
    console.log('Lesson Body Text:');
    console.log(lessonData.bodyText.substring(0, 800));
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
