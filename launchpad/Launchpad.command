#!/bin/zsh
# Double-click to start Launchpad and open it in your browser.
cd "$(dirname "$0")"
if ! curl -s -o /dev/null http://localhost:4400; then
  node server.js &
  sleep 1
fi
open http://localhost:4400
wait
