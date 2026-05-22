#!/bin/bash
# Check if Next.js is running
if ! ss -tlnp | grep -q ":3000"; then
  cd /home/z/my-project
  rm -f .next/dev/lock
  NODE_ENV=production node .next/standalone/server.js &
fi
