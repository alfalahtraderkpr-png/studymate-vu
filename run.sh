#!/bin/bash
cd /home/z/my-project
while true; do
  rm -f .next/dev/lock
  NODE_ENV=production node .next/standalone/server.js
  echo "Server exited, restarting..."
  sleep 1
done
