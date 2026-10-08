#!/bin/bash
# Ciabatta Club case: stop any old copy of the server, start this one, open the back office.
cd "$(dirname "$0")"
OLD=$(lsof -ti tcp:8787 2>/dev/null)
if [ -n "$OLD" ]; then echo "Stopping old server on port 8787 (pid $OLD)"; kill $OLD; sleep 1; fi
echo "Starting the server from: $(pwd)"
(sleep 2; open "http://localhost:8787/admin/?v=$(date +%s)#/approach") &
node api/server.mjs
