#!/bin/bash
cd /home/z/my-project
rm -f .next/dev/lock
export NODE_ENV=production
exec node .next/standalone/server.js
