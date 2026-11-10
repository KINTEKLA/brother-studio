import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import os

DATA_HOME = Path(
    os.environ.get(
        "XDG_DATA_HOME",
        str(Path.home() / ".local/share")
    )
)

HISTORY_DIR = Path(
    os.environ.get(
        "BROTHER_STUDIO_DATA_DIR",
        str(DATA_HOME / "brother-studio")
    )
)

IMAGES_DIR = HISTORY_DIR / "images"
INDEX_FILE = HISTORY_DIR / "prints.json"

def safe_history_image_path(filename):
    if not isinstance(filename, str):
        raise ValueError("Invalid history filename")

    import re
    if not re.fullmatch(r"[0-9a-f]{32}\.png", filename):
        raise ValueError("Invalid history filename")

    path = IMAGES_DIR / filename
    if path.is_symlink():
        raise ValueError("History image cannot be a symbolic link")

    return path


def load_history():
    if not INDEX_FILE.exists():
        return []
    return json.loads(INDEX_FILE.read_text())


def save_print(
    image, contrast, threshold, dither,
    method=None, line_spacing=6, background_cutoff=180
):
    if method is None:
        method = "floyd" if dither else "threshold"
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    print_id = uuid4().hex
    filename = f"{print_id}.png"
    image.save(IMAGES_DIR / filename, format="PNG")

    records = json.loads(INDEX_FILE.read_text()) if INDEX_FILE.exists() else []
    records.insert(0, {
        "id": print_id,
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "filename": filename,
        "contrast": contrast,
        "threshold": threshold,
        "dither": dither,
        "method": method,
        "line_spacing": line_spacing,
        "background_cutoff": background_cutoff
    })

    INDEX_FILE.write_text(json.dumps(records, indent=2))
