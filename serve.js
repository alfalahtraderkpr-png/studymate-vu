const { spawn } = require('child_process');
const http = require('http');

// Simple health-check + restart wrapper
let child = null;
let restartCount = 0;

function startServer() {
  console.log(`[wrapper] Starting Next.js (attempt ${++restartCount})...`);
  
  child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code, signal) => {
    console.log(`[wrapper] Server exited with code=${code} signal=${signal}`);
    child = null;
    // Restart after 2 seconds
    setTimeout(startServer, 2000);
  });
}

startServer();

// Keep process alive
process.on('SIGTERM', () => { if(child) child.kill(); process.exit(0); });
process.on('SIGINT', () => { if(child) child.kill(); process.exit(0); });
