#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Brother Studio — Linux Installation"
echo "-----------------------------------"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: Python 3 is required."
    exit 1
fi

echo "Creating Python virtual environment..."
python3 -m venv .venv

echo "Installing dependencies..."
.venv/bin/python -m pip install -r requirements.txt

echo ""
echo "Installation complete."
echo "Start Brother Studio using ./launch.sh"
