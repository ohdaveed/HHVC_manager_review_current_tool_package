#!/bin/bash
# Auto-kill existing process on port and start server

PORT=${PORT:-8080}
HOST=${HOST:-127.0.0.1}

# Kill existing listener on port (LISTEN state only — matching any socket on
# the port would also kill unrelated clients connected to it)
if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:"$PORT" -sTCP:LISTEN | xargs -r kill -9 2>/dev/null
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "$PORT"/tcp 2>/dev/null
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | xargs -r kill -9 2>/dev/null
elif command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep ":$PORT " | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | xargs -r kill -9 2>/dev/null
fi

# Wait a moment for port to be released
sleep 0.2

# Start the server
exec bun run --watch server.ts