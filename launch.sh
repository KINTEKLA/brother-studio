#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
    echo "Brother Studio is not installed."
    echo "Run ./install.sh first."
    exit 1
fi

export BROTHER_STUDIO_HOST="${BROTHER_STUDIO_HOST:-127.0.0.1}"
export BROTHER_STUDIO_PORT="${BROTHER_STUDIO_PORT:-5000}"

echo "Starting Brother Studio..."
echo "Open http://${BROTHER_STUDIO_HOST}:${BROTHER_STUDIO_PORT}"

exec .venv/bin/python app.py
