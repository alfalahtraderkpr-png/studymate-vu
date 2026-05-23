// Quick integration test for the fixed VULMS scraper
// Run: npx tsx scripts/test-scraper.ts

const STUDENT_ID = 'BC240404472';
const PASSWORD = '@Bilal@123';

async function main() {
  // We need to use the compiled JS since we're running outside Next.js
  // Import the functions directly
  const { loginToVULMS, getAllCourseData } = require('../src/lib/vulms');

  console.log('═══ TEST 1: Login ═══');
  const loginResult = await loginToVULMS(STUDENT_ID, PASSWORD);
  console.log('Login:', loginResult.success ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('Subjects found:', loginResult.subjects.length);
  loginResult.subjects.forEach((s: any) => console.log(`  ${s.code}: ${s.name.substring(0, 50)}`));

  if (!loginResult.success || loginResult.subjects.length === 0) {
    console.log('Login failed or no subjects. Aborting.');
    return;
  }

  const firstSubject = loginResult.subjects[0];
  console.log(`\n═══ TEST 2: Get All Course Data for ${firstSubject.code} ═══`);

  const courseData = await getAllCourseData(
    loginResult.cookies,
    firstSubject.url,
    firstSubject.code
  );

  console.log('\n═══ RESULTS ═══');
  console.log(`Handouts: ${courseData.handouts.length}`);
  if (courseData.handouts.length > 0) {
    courseData.handouts.slice(0, 5).forEach((h: any) => console.log(`  📄 ${h.name} (${h.status})`));
    if (courseData.handouts.length > 5) console.log(`  ... and ${courseData.handouts.length - 5} more`);
  }

  console.log(`\nVideos: ${courseData.videos.length}`);
  if (courseData.videos.length > 0) {
    courseData.videos.slice(0, 5).forEach((v: any) => console.log(`  🎬 ${v.name} → ${v.youtubeUrl.substring(0, 60)}...`));
    if (courseData.videos.length > 5) console.log(`  ... and ${courseData.videos.length - 5} more`);
  }

  console.log(`\nQuizzes: ${courseData.quizzes.length}`);
  if (courseData.quizzes.length > 0) {
    courseData.quizzes.forEach((q: any) => console.log(`  📝 ${q.name} | ${q.openDate} - ${q.closeDate} | Status: ${q.status} | Marks: ${q.totalMarks} | Score: ${q.score}`));
  }

  console.log(`\nAssignments: ${courseData.assignments.length}`);
  if (courseData.assignments.length > 0) {
    courseData.assignments.forEach((a: any) => console.log(`  📋 ${a.name} | Due: ${a.dueDate} | Status: ${a.status} | Marks: ${a.totalMarks}`));
  }

  console.log(`\nGDBs: ${courseData.gdbs.length}`);
  if (courseData.gdbs.length > 0) {
    courseData.gdbs.forEach((g: any) => console.log(`  💬 ${g.name} | ${g.openDate} - ${g.closeDate} | Status: ${g.status}`));
  }

  console.log(`\nLessons: ${courseData.lessons.length}`);

  // Summary
  const total = courseData.handouts.length + courseData.videos.length + courseData.quizzes.length + courseData.assignments.length + courseData.gdbs.length;
  console.log('\n═══ SUMMARY ═══');
  console.log(`Total data items: ${total}`);
  if (total === 0) {
    console.log('❌ STILL NO DATA! Something is still wrong.');
  } else {
    console.log('✅ DATA IS BEING FETCHED! The scraper is working.');
  }
}

main().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
