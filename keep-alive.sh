#!/bin/bash
# Keep-alive script: restarts Next.js server whenever it dies
cd /home/z/my-project

while true; do
  rm -f .next/dev/lock
  NODE_ENV=production node .next/standalone/server.js &
  SERVER_PID=$!
  
  # Wait for port to be ready
  for i in $(seq 1 15); do
    sleep 0.5
    if ss -tlnp | grep -q ":3000"; then
      echo "$(date): Server started on :3000 (PID $SERVER_PID)"
      break
    fi
  done
  
  # Wait for server to die
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 2
  done
  
  echo "$(date): Server died, restarting..."
  sleep 1
done
