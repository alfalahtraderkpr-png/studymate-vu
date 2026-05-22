#!/bin/bash
while true; do
  cd /home/z/my-project
  rm -f .next/dev/lock
  echo "$(date): Starting server..." >> /tmp/supervisor.log
  NODE_ENV=production node .next/standalone/server.js >> /tmp/supervisor.log 2>&1
  EXIT_CODE=$?
  echo "$(date): Server exited with code $EXIT_CODE, restarting in 2s..." >> /tmp/supervisor.log
  sleep 2
done
