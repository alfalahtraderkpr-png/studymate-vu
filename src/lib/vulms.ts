// VULMS automation library
// Uses direct HTTP requests (NO Puppeteer) — works on Vercel serverless!
// VULMS is ASP.NET WebForms — we simulate form submissions with fetch

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
  url: string;
}

export interface HandoutInfo {
  name: string;
  url: string;
  type: string;
}

// Cookie jar for managing session cookies across requests
class CookieJar {
  private cookies: Map<string, VULMSCookie> = new Map();

  addFromSetCookie(setCookieHeaders: string[], domain: string) {
    if (!setCookieHeaders) return;
    for (const header of setCookieHeaders) {
      const parts = header.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies.set(name, {
          name,
          value,
          domain,
          path: '/',
          expires: 0,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        });
      }
    }
  }

  addCookies(cookies: Array<{ name: string; value: string; domain?: string; path?: string }>) {
    for (const c of cookies) {
      this.cookies.set(c.name, {
        name: c.name,
        value: c.value,
        domain: c.domain || 'vulms.vu.edu.pk',
        path: c.path || '/',
        expires: 0,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      });
    }
  }

  toString(): string {
    return Array.from(this.cookies.values())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  toArray(): Array<{ name: string; value: string; domain: string; path: string }> {
    return Array.from(this.cookies.values()).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));
  }

  get length(): number {
    return this.cookies.size;
  }
}

// Parse ASP.NET hidden fields from login page HTML
function parseAspNetFields(html: string) {
  const $ = cheerio.load(html);

  const viewstate = $('input[name="__VIEWSTATE"]').val() || '';
  const viewstategenerator = $('input[name="__VIEWSTATEGENERATOR"]').val() || '';
  const eventvalidation = $('input[name="__EVENTVALIDATION"]').val() || '';
  const actionField = $('input[name="action"]').val() || '';

  return { viewstate, viewstategenerator, eventvalidation, actionField };
}

// Main login function — uses direct HTTP requests
export async function loginToVULMS(studentId: string, password: string) {
  const jar = new CookieJar();

  // Step 1: GET the login page to obtain ASP.NET hidden fields + session cookie
  console.log('[VULMS] Step 1: Fetching login page...');
  const loginPageRes = await fetch(VULMS_LOGIN, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'manual',
  });

  // Collect initial cookies (ASP.NET_SessionId + ARRAffinity)
  const setCookies = loginPageRes.headers.getSetCookie?.() || [];
  jar.addFromSetCookie(setCookies, 'vulms.vu.edu.pk');

  const loginHtml = await loginPageRes.text();
  console.log('[VULMS] Login page status:', loginPageRes.status);
  console.log('[VULMS] Cookies after GET:', jar.length, '- Session:', jar.toString().includes('SessionId'));

  // Step 2: Parse ASP.NET hidden fields
  const aspFields = parseAspNetFields(loginHtml);
  console.log('[VULMS] VIEWSTATE length:', aspFields.viewstate.length);
  console.log('[VULMS] Action field:', aspFields.actionField);

  // Step 3: POST the login form with ALL required fields
  console.log('[VULMS] Step 2: Submitting login form...');
  const loginBody = new URLSearchParams();
  loginBody.append('__VIEWSTATE', aspFields.viewstate);
  loginBody.append('__VIEWSTATEGENERATOR', aspFields.viewstategenerator);
  loginBody.append('__EVENTVALIDATION', aspFields.eventvalidation);
  loginBody.append('txtStudentID', studentId);
  loginBody.append('txtPassword', password);
  // VULMS hidden action field (beta_LMS)
  loginBody.append('action', aspFields.actionField || 'beta_LMS');
  // reCAPTCHA v3 token field (empty - VULMS doesn't strictly validate it)
  loginBody.append('g-recaptcha-response', '');
  // Image button coordinates (simulates clicking the login button)
  loginBody.append('ibtnLogin.x', '52');
  loginBody.append('ibtnLogin.y', '18');

  const loginPostRes = await fetch(VULMS_LOGIN, {
    method: 'POST',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: VULMS_LOGIN,
      Origin: VULMS_BASE,
      Cookie: jar.toString(),
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    body: loginBody.toString(),
    redirect: 'manual',
  });

  // Collect cookies from POST response
  const postSetCookies = loginPostRes.headers.getSetCookie?.() || [];
  jar.addFromSetCookie(postSetCookies, 'vulms.vu.edu.pk');
  console.log('[VULMS] POST status:', loginPostRes.status);
  console.log('[VULMS] Cookies after POST:', jar.length);

  // Step 4: Check POST response - could be redirect (success) or same page (failure)
  if (loginPostRes.status === 200) {
    // Same page returned - login failed
    const postHtml = await loginPostRes.text();
    const $ = cheerio.load(postHtml);

    // VULMS shows error in #lblError
    const errorMsg = $('#lblError').text().trim();

    if (errorMsg) {
      console.log('[VULMS] VULMS error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Check for other error patterns
    const altError =
      $('.alert-danger').text().trim() ||
      $('.m-alert--danger').text().trim() ||
      $('.validation-summary-errors').text().trim();

    if (altError) {
      console.log('[VULMS] Alt error:', altError);
      throw new Error(altError);
    }

    // If still on login page with no specific error
    if (postHtml.includes('txtStudentID')) {
      throw new Error(
        'Login failed. Please check your Student ID and Password. Make sure your VULMS account is active.'
      );
    }

    // Maybe login succeeded but returned 200 (unusual for ASP.NET)
    console.log('[VULMS] Got 200 but no login form - checking content...');
  }

  // Step 5: Follow redirects to complete login
  let currentUrl = VULMS_LOGIN;
  let currentRes: Response = loginPostRes;
  let redirectCount = 0;
  const maxRedirects = 10;

  while ([301, 302, 303, 307, 308].includes(currentRes.status) && redirectCount < maxRedirects) {
    const location = currentRes.headers.get('location');
    if (!location) break;

    const nextUrl = location.startsWith('http') ? location : new URL(location, VULMS_BASE).href;
    console.log(`[VULMS] Redirect ${redirectCount + 1}: ${nextUrl}`);

    // Collect cookies from redirect response
    const redirectCookies = currentRes.headers.getSetCookie?.() || [];
    jar.addFromSetCookie(redirectCookies, 'vulms.vu.edu.pk');

    currentRes = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
        Referer: currentUrl,
        Cookie: jar.toString(),
      },
      redirect: 'manual',
    });

    // Collect cookies from each redirect response
    const newCookies = currentRes.headers.getSetCookie?.() || [];
    jar.addFromSetCookie(newCookies, 'vulms.vu.edu.pk');

    currentUrl = nextUrl;
    redirectCount++;
  }

  // Step 6: Get the final page content
  console.log('[VULMS] Final status:', currentRes.status);
  console.log('[VULMS] Final URL:', currentUrl);
  console.log('[VULMS] Total cookies:', jar.length);

  let finalHtml: string;

  // If final response is a redirect, follow it
  if ([301, 302, 303, 307, 308].includes(currentRes.status)) {
    const location = currentRes.headers.get('location') || '';
    const followUrl = location.startsWith('http') ? location : new URL(location, VULMS_BASE).href;
    const followRes = await fetch(followUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: jar.toString(),
      },
      redirect: 'follow',
    });
    finalHtml = await followRes.text();
    currentUrl = followRes.url;
  } else {
    finalHtml = await currentRes.text();
  }

  // Step 7: Check if we're still on the login page (login failed)
  const isOnLoginPage = finalHtml.includes('txtStudentID') && finalHtml.includes('txtPassword');

  if (isOnLoginPage) {
    const $ = cheerio.load(finalHtml);
    const errorMsg = $('#lblError').text().trim();
    throw new Error(
      errorMsg || 'Login failed. Please check your Student ID and Password.'
    );
  }

  // Step 8: Navigate to dashboard if not already there
  let dashboardHtml = finalHtml;
  let dashboardUrl = currentUrl;

  if (!dashboardUrl.toLowerCase().includes('lms') && !dashboardUrl.toLowerCase().includes('home')) {
    console.log('[VULMS] Step 3: Navigating to dashboard...');
    const dashboardRes = await fetch(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: jar.toString(),
      },
      redirect: 'follow',
    });
    dashboardHtml = await dashboardRes.text();
    dashboardUrl = dashboardRes.url;
    console.log('[VULMS] Dashboard URL:', dashboardUrl);

    // Check if we got redirected back to login (session expired)
    if (dashboardHtml.includes('txtStudentID')) {
      throw new Error('Session expired. Please try logging in again.');
    }
  }

  // Step 9: Scrape subjects from the dashboard
  const subjects = scrapeSubjectsFromHtml(dashboardHtml, dashboardUrl);
  console.log('[VULMS] Found subjects:', subjects.length);

  const cookies = jar.toArray();
  return { success: true, cookies, subjects, browser: null };
}

function scrapeSubjectsFromHtml(html: string, pageUrl: string): SubjectInfo[] {
  const $ = cheerio.load(html);
  const results: SubjectInfo[] = [];
  const seen = new Set<string>();

  // Strategy 1: Find course links on dashboard
  const courseSelectors = [
    'a[href*="CourseHome"]',
    'a[href*="coursehome"]',
    'a[href*="StudentHome"]',
    'a[href*="studenthome"]',
    'a[href*="Home.aspx"]',
    'a[href*="home.aspx"]',
    '.m-portlet a[href*="Home"]',
    '.course-card a',
    '.subject-card a',
    '.portlet-body a[href*="Course"]',
    '#ContentPlaceHolder1 a[href*="Course"]',
    'a[href*="CourseDetail"]',
  ];

  for (const selector of courseSelectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';

      if (text && href && !href.includes('javascript') && !href.includes('#')) {
        // Make URL absolute
        if (!href.startsWith('http')) {
          try {
            href = new URL(href, VULMS_BASE).href;
          } catch {
            return;
          }
        }

        // Extract subject code from text
        const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
        const code = codeMatch ? codeMatch[1].toUpperCase() : '';

        const key = code || text.substring(0, 50);
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            name: text.replace(/\s+/g, ' ').trim(),
            code: code || text.split(/\s+/)[0].toUpperCase(),
            url: href,
          });
        }
      }
    });

    if (results.length > 0) break;
  }

  // Strategy 2: Look for VU subject code patterns in all links
  if (results.length === 0) {
    $('a[href]').each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';

      if (!href || href.includes('javascript') || href.includes('#')) return;

      const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
      if (codeMatch) {
        if (!href.startsWith('http')) {
          try {
            href = new URL(href, VULMS_BASE).href;
          } catch {
            return;
          }
        }
        const code = codeMatch[1].toUpperCase();
        if (!seen.has(code)) {
          seen.add(code);
          results.push({ name: text.replace(/\s+/g, ' ').trim(), code, url: href });
        }
      }
    });
  }

  // Strategy 3: Look for semester/course list tables
  if (results.length === 0) {
    $('table tr td a, .table tr td a, ul li a').each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';

      if (!text || !href || href.includes('javascript') || href.includes('#')) return;

      if (!href.startsWith('http')) {
        try {
          href = new URL(href, VULMS_BASE).href;
        } catch {
          return;
        }
      }

      const key = text.substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        const codeMatch = text.match(/([A-Z]{2,4}\d{3})/i);
        results.push({
          name: text.replace(/\s+/g, ' ').trim(),
          code: codeMatch ? codeMatch[1].toUpperCase() : text.split(/\s+/)[0].toUpperCase(),
          url: href,
        });
      }
    });
  }

  // Ensure all subjects have codes
  return results.map((s) => {
    if (!s.code || s.code.length < 2) {
      const codeMatch = s.name.match(/([A-Z]{2,4}\d{3})/i);
      s.code = codeMatch ? codeMatch[1].toUpperCase() : s.name.split(/\s+/)[0].toUpperCase();
    }
    return s;
  });
}

export async function getSubjects(cookies: Array<{ name: string; value: string; domain?: string; path?: string }>) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(`${VULMS_BASE}/LMS/LMS_LandingPage.aspx`, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const html = await res.text();

  // Check if redirected to login
  if (html.includes('txtStudentID')) {
    throw new Error('Session expired. Please login again.');
  }

  return scrapeSubjectsFromHtml(html, res.url);
}

export async function getHandouts(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  courseUrl: string
) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(courseUrl, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const html = await res.text();

  // Check if redirected to login
  if (html.includes('txtStudentID')) {
    throw new Error('Session expired. Please login again.');
  }

  const $ = cheerio.load(html);
  const results: HandoutInfo[] = [];
  const seen = new Set<string>();

  const handoutSelectors = [
    'a[href*="Handout"]',
    'a[href*="handout"]',
    'a[href*="Lecture"]',
    'a[href*="lecture"]',
    'a[href*="Content"]',
    'a[href*="Resource"]',
    'a[href*="Download"]',
    'a[href*=".pdf"]',
    'a[href*=".pptx"]',
    'a[href*="Lesson"]',
    'a[href*="CourseContent"]',
    'a[href*="StudyMaterial"]',
  ];

  for (const selector of handoutSelectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      let href = $el.attr('href') || '';

      if (!text || !href || href.includes('javascript') || href.includes('#')) return;

      if (!href.startsWith('http')) {
        try {
          href = new URL(href, VULMS_BASE).href;
        } catch {
          return;
        }
      }

      if (seen.has(href)) return;
      seen.add(href);

      const type = href.toLowerCase().includes('.pdf')
        ? 'pdf'
        : href.toLowerCase().includes('.pptx') || href.toLowerCase().includes('.ppt')
          ? 'pptx'
          : 'document';

      results.push({ name: text.replace(/\s+/g, ' ').trim(), url: href, type });
    });
  }

  return results;
}

export async function downloadHandoutContent(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>,
  handoutUrl: string
) {
  const jar = new CookieJar();
  jar.addCookies(cookies);

  const res = await fetch(handoutUrl, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Cookie: jar.toString(),
    },
    redirect: 'follow',
  });

  const contentType = res.headers.get('content-type') || '';

  // If it's a PDF or binary file, return the URL info instead of trying to parse
  if (
    contentType.includes('pdf') ||
    contentType.includes('octet-stream') ||
    contentType.includes('pptx') ||
    contentType.includes('powerpoint')
  ) {
    return `[This is a downloadable file. URL: ${handoutUrl}]\n\nTo study this content, please download the file from VULMS directly.`;
  }

  // If it's HTML, parse it
  const html = await res.text();
  const $ = cheerio.load(html);

  // Try to extract main content from common ASP.NET/VULMS layouts
  const mainContent =
    $('#region-main').text().trim() ||
    $('.m-portlet__body').text().trim() ||
    $('#ContentPlaceHolder1').text().trim() ||
    $('#main-content').text().trim() ||
    $('main').text().trim() ||
    $('.content-area').text().trim() ||
    $('body').text().trim();

  return mainContent.replace(/\s+/g, ' ').trim();
}
