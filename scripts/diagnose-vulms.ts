// Diagnostic script to examine VULMS HTML structure
// Run: npx tsx scripts/diagnose-vulms.ts

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

  // Stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as any).chrome = { runtime: {} };
  });

  console.log('=== STEP 1: Login ===');
  await page.goto(VULMS_BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('#txtStudentID', { timeout: 15000 });

  // Wait for reCAPTCHA
  await page.waitForFunction(() => {
    const field = document.querySelector('#g-recaptcha-response');
    return field && field.value && field.value.length > 10;
  }, { timeout: 15000 }).catch(() => console.log('reCAPTCHA not found'));

  await new Promise(r => setTimeout(r, 1000));

  // Fill credentials
  await page.click('#txtStudentID', { clickCount: 3 });
  await page.type('#txtStudentID', STUDENT_ID, { delay: 50 });
  await page.click('#txtPassword', { clickCount: 3 });
  await page.type('#txtPassword', PASSWORD, { delay: 50 });
  await new Promise(r => setTimeout(r, 1000));

  // Click Sign In
  await Promise.all([
    page.click('#ibtnLogin'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
  ]).catch(async () => {
    const form = await page.$('#ctl00');
    if (form) await page.evaluate(() => { (document.querySelector('#ctl00') as HTMLFormElement).submit(); });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  });

  const loginUrl = page.url();
  const loginContent = await page.content();
  const stillOnLoginPage = loginContent.includes('txtStudentID');

  if (stillOnLoginPage) {
    console.log('LOGIN FAILED! Still on login page.');
    const error = await page.evaluate(() => {
      const el = document.querySelector('#lblError');
      return el ? el.textContent?.trim() : 'Unknown error';
    });
    console.log('Error:', error);
    await browser.close();
    return;
  }

  console.log('LOGIN SUCCESS! URL:', loginUrl);

  // Navigate to Home if needed
  if (!loginUrl.toLowerCase().includes('home.aspx')) {
    await page.goto(`${VULMS_BASE}/Home.aspx`, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  console.log('\n=== STEP 2: Dashboard HTML Structure ===');

  // Get all links on dashboard
  const dashboardLinks = await page.evaluate(() => {
    const links: Array<{text: string, href: string, id: string, className: string}> = [];
    document.querySelectorAll('a').forEach((el) => {
      const a = el as HTMLAnchorElement;
      links.push({
        text: a.textContent?.trim().substring(0, 80) || '',
        href: a.getAttribute('href') || '',
        id: a.id || '',
        className: a.className || '',
      });
    });
    return links;
  });

  console.log('Dashboard links count:', dashboardLinks.length);
  console.log('\n--- Course Links ---');
  const courseLinks = dashboardLinks.filter(l => l.href.includes('ibtnCourseHome') || l.href.includes('CourseHome') || l.href.includes('__doPostBack'));
  courseLinks.forEach(l => console.log(`  [${l.id}] ${l.text} | href: ${l.href.substring(0, 100)}`));

  // Save dashboard HTML
  const dashboardHtml = await page.evaluate(() => document.body.innerHTML);
  require('fs').writeFileSync('/home/z/my-project/download/dashboard.html', dashboardHtml);
  console.log('\nDashboard HTML saved to download/dashboard.html');

  // Get subjects with eventTargets
  const subjects = await page.evaluate(() => {
    const results: Array<{name: string, code: string, eventTarget: string, href: string}> = [];
    const seen = new Set<string>();
    const allLinks = document.querySelectorAll('a');
    allLinks.forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim().replace(/\s+/g, ' ') || '';
      const href = a.getAttribute('href') || '';
      const codeMatch = text.match(/([A-Z]{2,4}\d{3}[A-Z]?)/i);
      const code = codeMatch ? codeMatch[1].toUpperCase() : '';
      if (!code || code.length < 4 || seen.has(code)) return;
      seen.add(code);
      const match = href.match(/__doPostBack\('([^']+)'/);
      const eventTarget = match ? match[1] : '';
      results.push({ name: text, code, eventTarget, href });
    });
    return results;
  });

  console.log('\n--- Subjects Found ---');
  subjects.forEach(s => console.log(`  ${s.code}: ${s.name} | eventTarget: ${s.eventTarget || 'NONE'}`));

  if (subjects.length === 0) {
    console.log('\nNo subjects found! Dumping all link text:');
    dashboardLinks.slice(0, 50).forEach(l => {
      if (l.text) console.log(`  "${l.text}" | href: ${l.href.substring(0, 80)}`);
    });
    await browser.close();
    return;
  }

  // Click on first subject
  const firstSubject = subjects[0];
  console.log(`\n=== STEP 3: Navigate to Course ${firstSubject.code} ===`);

  if (firstSubject.eventTarget) {
    console.log('Using postback:', firstSubject.eventTarget);
    await page.evaluate((target) => {
      (window as any).__doPostBack(target, '');
    }, firstSubject.eventTarget);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  } else {
    console.log('No eventTarget, trying direct URL...');
  }

  await new Promise(r => setTimeout(r, 3000));

  const courseUrl = page.url();
  console.log('Course page URL:', courseUrl);

  // Save course page HTML
  const courseHtml = await page.evaluate(() => document.body.innerHTML);
  require('fs').writeFileSync('/home/z/my-project/download/course-page.html', courseHtml);
  console.log('Course page HTML saved to download/course-page.html');

  // Dump course page structure
  console.log('\n=== STEP 4: Course Page Analysis ===');

  const courseAnalysis = await page.evaluate(() => {
    const result: {
      title: string;
      url: string;
      allLinks: Array<{text: string, href: string, id: string}>;
      iframes: Array<{src: string, title: string}>;
      tables: Array<{id: string, rows: number, headers: string}>;
      tabLinks: Array<{text: string, href: string, id: string}>;
      sections: Array<{id: string, className: string, text: string}>;
      bodyTextPreview: string;
    } = {
      title: document.title,
      url: window.location.href,
      allLinks: [],
      iframes: [],
      tables: [],
      tabLinks: [],
      sections: [],
      bodyTextPreview: document.body.innerText.substring(0, 3000),
    };

    // All links
    document.querySelectorAll('a').forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim().replace(/\s+/g, ' ').substring(0, 80) || '';
      const href = a.getAttribute('href') || '';
      result.allLinks.push({ text, href, id: a.id || '' });
    });

    // Iframes (YouTube embeds)
    document.querySelectorAll('iframe').forEach((el) => {
      result.iframes.push({ src: el.getAttribute('src') || '', title: el.getAttribute('title') || '' });
    });

    // Tables
    document.querySelectorAll('table').forEach((el) => {
      const t = el as HTMLTableElement;
      const headers: string[] = [];
      t.querySelectorAll('th').forEach(th => headers.push(th.textContent?.trim() || ''));
      result.tables.push({ id: t.id || '', rows: t.rows.length, headers: headers.join(', ') });
    });

    // Tab/menu links (navigation within course page)
    document.querySelectorAll('[class*="tab"] a, [class*="menu"] a, [class*="nav"] a, [role="tab"]').forEach((el) => {
      const a = el as HTMLAnchorElement;
      result.tabLinks.push({
        text: a.textContent?.trim() || '',
        href: a.getAttribute('href') || '',
        id: a.id || '',
      });
    });

    // Main content sections
    document.querySelectorAll('[class*="portlet"], [class*="widget"], [class*="section"], [class*="panel"]').forEach((el) => {
      result.sections.push({
        id: el.id || '',
        className: el.className.substring(0, 80),
        text: el.textContent?.trim().substring(0, 100) || '',
      });
    });

    return result;
  });

  console.log('Page Title:', courseAnalysis.title);
  console.log('Page URL:', courseAnalysis.url);
  console.log('Total Links:', courseAnalysis.allLinks.length);
  console.log('Iframes:', courseAnalysis.iframes.length);
  console.log('Tables:', courseAnalysis.tables.length);

  console.log('\n--- Tables ---');
  courseAnalysis.tables.forEach(t => console.log(`  [${t.id}] ${t.rows} rows, headers: ${t.headers}`));

  console.log('\n--- Iframes ---');
  courseAnalysis.iframes.forEach(f => console.log(`  src: ${f.src}`));

  console.log('\n--- Tab/Menu Links ---');
  courseAnalysis.tabLinks.forEach(t => console.log(`  [${t.id}] ${t.text} | href: ${t.href.substring(0, 80)}`));

  console.log('\n--- All Links (filtered) ---');
  const interestingLinks = courseAnalysis.allLinks.filter(l =>
    l.text && (
      l.href.includes('Download') ||
      l.href.includes('Handout') ||
      l.href.includes('Lesson') ||
      l.href.includes('Lecture') ||
      l.href.includes('Quiz') ||
      l.href.includes('Assignment') ||
      l.href.includes('Video') ||
      l.href.includes('youtube') ||
      l.href.includes('youtu') ||
      l.href.includes('.pdf') ||
      l.href.includes('.pptx') ||
      l.href.includes('__doPostBack') ||
      l.href.includes('ibtnCourseHome') ||
      l.href.includes('lbtn') ||
      l.text.toLowerCase().includes('download') ||
      l.text.toLowerCase().includes('handout') ||
      l.text.toLowerCase().includes('video') ||
      l.text.toLowerCase().includes('quiz') ||
      l.text.toLowerCase().includes('assignment') ||
      l.text.toLowerCase().includes('lecture') ||
      l.text.toLowerCase().includes('lesson')
    )
  );

  if (interestingLinks.length > 0) {
    interestingLinks.forEach(l => console.log(`  [${l.id}] "${l.text}" | href: ${l.href.substring(0, 120)}`));
  } else {
    console.log('  No interesting links found. Showing ALL links:');
    courseAnalysis.allLinks.filter(l => l.text).slice(0, 80).forEach(l =>
      console.log(`  [${l.id}] "${l.text}" | href: ${l.href.substring(0, 120)}`)
    );
  }

  console.log('\n--- Body Text Preview (first 2000 chars) ---');
  console.log(courseAnalysis.bodyTextPreview.substring(0, 2000));

  // Now try clicking on different tabs/sections
  console.log('\n=== STEP 5: Try Clicking Navigation Elements ===');

  // Try finding and clicking "Download Files" or similar
  const downloadClicked = await page.evaluate(() => {
    const allElements = document.querySelectorAll('a, button, span, li, div[onclick]');
    for (const el of allElements) {
      const text = el.textContent?.trim().toLowerCase() || '';
      if (text.includes('download') || text.includes('handout') || text.includes('study material')) {
        (el as HTMLElement).click();
        return text.substring(0, 80);
      }
    }
    return null;
  });

  if (downloadClicked) {
    console.log('Clicked on:', downloadClicked);
    await new Promise(r => setTimeout(r, 3000));
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

    const downloadHtml = await page.evaluate(() => document.body.innerHTML);
    require('fs').writeFileSync('/home/z/my-project/download/download-page.html', downloadHtml);
    console.log('Download page HTML saved to download/download-page.html');

    // Check for files on download page
    const downloadFiles = await page.evaluate(() => {
      const files: Array<{text: string, href: string}> = [];
      document.querySelectorAll('a').forEach((el) => {
        const a = el as HTMLAnchorElement;
        const href = a.href || a.getAttribute('href') || '';
        const text = a.textContent?.trim() || '';
        if (href.includes('.pdf') || href.includes('.pptx') || href.includes('.doc') || href.includes('Download') || href.includes('upload') || href.includes('Content')) {
          files.push({ text: text.substring(0, 80), href });
        }
      });
      return files;
    });

    console.log('Files found on download page:', downloadFiles.length);
    downloadFiles.forEach(f => console.log(`  "${f.text}" | ${f.href.substring(0, 100)}`));
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
