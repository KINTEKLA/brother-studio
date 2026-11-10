from print_history import save_print
from flask import Flask, render_template, request, jsonify, send_file
from pathlib import Path
from PIL import Image
Image.ANTIALIAS = Image.Resampling.LANCZOS
import subprocess
import tempfile
import io
import json
import math
from processing import prepare_image

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

import sys
import os

PRINTER = str(Path(sys.executable).parent / "brother_ql")
PRINTER_BACKEND = os.environ.get("BROTHER_STUDIO_BACKEND", "pyusb")
PRINTER_MODEL = os.environ.get("BROTHER_STUDIO_MODEL", "QL-570")
PRINTER_ADDRESS = os.environ.get("BROTHER_STUDIO_ADDRESS", "usb://0x04f9:0x2028")
LABEL_SIZE = os.environ.get("BROTHER_STUDIO_LABEL", "62")



def get_processing_settings():
    contrast = max(0.1, min(3.0, float(request.form.get("contrast", 1.0))))
    threshold = max(0, min(255, int(request.form.get("threshold", 128))))
    dither = request.form.get("dither") == "true"

    method = request.form.get("method")
    if method is None:
        method = "floyd" if dither else "threshold"
    if method not in ("threshold", "floyd", "line"):
        raise ValueError("Unsupported processing method")

    line_spacing = max(3, min(10, int(request.form.get("line_spacing", 6))))
    background_cutoff = max(0, min(255, int(request.form.get("background_cutoff", 180))))

    return contrast, threshold, dither, method, line_spacing, background_cutoff



def get_rotation_settings():
    value = request.form.get("rotate", "0")
    if value not in ("0", "90"):
        raise ValueError("Unsupported print orientation")
    return int(value)


def get_crop_settings():
    raw = request.form.get("crop")

    if not raw:
        return None

    crop = json.loads(raw)

    if not isinstance(crop, list) or len(crop) != 4:
        raise ValueError("Invalid crop coordinates")

    if any(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        for value in crop
    ):
        raise ValueError("Invalid crop coordinates")

    x, y, w, h = crop

    if not (
        0 <= x < 1
        and 0 <= y < 1
        and 0 < w <= 1
        and 0 < h <= 1
        and x + w <= 1.000001
        and y + h <= 1.000001
    ):
        raise ValueError("Crop coordinates outside image")

    return x, y, w, h


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/preview", methods=["POST"])
def processed_preview():
    upload = request.files.get("image")
    if not upload:
        return jsonify(message="No image selected."), 400

    try:
        contrast, threshold, dither, method, spacing, cutoff = get_processing_settings()

        with Image.open(upload.stream) as source:
            image = prepare_image(
                source, contrast, threshold, dither,
                method=method,
                line_spacing=spacing,
                background_cutoff=cutoff,
                crop=get_crop_settings(),
                rotate=get_rotation_settings()
            )

        output = io.BytesIO()
        image.save(output, format="PNG")
        output.seek(0)
        return send_file(output, mimetype="image/png")
    except Exception as error:
        return jsonify(message=str(error)), 400


def get_copies():
    raw = request.form.get("copies", "1")
    if not raw.isdecimal():
        raise ValueError("Copies must be a whole number from 1 to 50")
    copies = int(raw)
    if not 1 <= copies <= 50:
        raise ValueError("Copies must be between 1 and 50")
    return copies


def print_copies(command, copies):
    completed = 0
    for _ in range(copies):
        try:
            result = subprocess.run(
                command, capture_output=True, text=True, timeout=60
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            return completed, str(error)

        if result.returncode:
            return completed, (
                result.stderr[-500:]
                or f"Printer exited with code {result.returncode}"
            )
        completed += 1

    return completed, None


@app.route("/print", methods=["POST"])
def print_image():
    upload = request.files.get("image")
    if not upload:
        return jsonify(message="No image selected."), 400

    try:
        copies = get_copies()
        with Image.open(upload.stream) as image:
            if image.format not in ("PNG", "JPEG"):
                return jsonify(message="Only PNG and JPEG are supported."), 400
            image.load()
            contrast, threshold, dither, method, spacing, cutoff = get_processing_settings()
            image = prepare_image(
                image, contrast, threshold, dither,
                method=method,
                line_spacing=spacing,
                background_cutoff=cutoff,
                crop=get_crop_settings(),
                rotate=get_rotation_settings()
            )

        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "print.png"
            image.save(path)

            command = [
                PRINTER,
                "-b", PRINTER_BACKEND,
                "-m", PRINTER_MODEL,
                "-p", PRINTER_ADDRESS,
                "print", "-l", LABEL_SIZE, "-r", "0",
                str(path)
            ]

            completed, error = print_copies(command, copies)
            if error:
                return jsonify(
                    message=f"Printed {completed} of {copies} copies. "
                            f"Printer error: {error}"
                ), 500

        try:
            save_print(
                image, contrast, threshold, dither,
                method, spacing, cutoff
            )
        except Exception as history_error:
            app.logger.exception("Print succeeded, but history saving failed")
            return jsonify(
                message="Print job completed, but history could not be saved."
            )

        return jsonify(
            message=f"Printed and cut {copies} "
                    f"{'copy' if copies == 1 else 'copies'}. "
                    "Saved to history."
        )

    except Exception as error:
        return jsonify(message=f"Error: {error}"), 500


@app.route("/history", methods=["GET"])
def get_print_history():
    import json
    from print_history import INDEX_FILE, load_history

    try:
        records = load_history()
        return jsonify(records)
    except (OSError, ValueError) as error:
        return jsonify(message=f"History error: {error}"), 500



@app.route("/history/image/<print_id>", methods=["GET"])
def get_history_image(print_id):
    import json
    from print_history import INDEX_FILE, load_history, IMAGES_DIR

    records = load_history()
    record = next((r for r in records if r["id"] == print_id), None)

    if record is None:
        return jsonify(message="History image not found."), 404

    image_path = IMAGES_DIR / record["filename"]

    if not image_path.is_file():
        return jsonify(message="Image file missing."), 404

    return send_file(image_path, mimetype="image/png")



@app.route("/history/reprint/<print_id>", methods=["POST"])
def reprint_history_image(print_id):
    import json
    from print_history import INDEX_FILE, load_history, IMAGES_DIR

    records = load_history()
    record = next((r for r in records if r["id"] == print_id), None)

    if record is None:
        return jsonify(message="Saved print not found."), 404

    image_path = IMAGES_DIR / record["filename"]
    if not image_path.is_file():
        return jsonify(message="Saved image is missing."), 404

    try:
        copies = get_copies()
    except ValueError as error:
        return jsonify(message=str(error)), 400

    command = [
        PRINTER,
        "-b", PRINTER_BACKEND,
        "-m", PRINTER_MODEL,
        "-p", PRINTER_ADDRESS,
        "print", "-l", LABEL_SIZE, "-r", "0",
        str(image_path)
    ]

    try:
        completed, error = print_copies(command, copies)
        if error:
            return jsonify(
                message=f"Reprinted {completed} of {copies} copies. "
                        f"Printer error: {error}"
            ), 500

        return jsonify(
            message=f"Reprinted and cut {copies} "
                    f"{'copy' if copies == 1 else 'copies'}."
        )
    except Exception as error:
        return jsonify(message=f"Printer error: {error}"), 500



@app.route("/history/delete", methods=["POST"])
def delete_history_entries():
    import json
    from print_history import INDEX_FILE, load_history, IMAGES_DIR

    data = request.get_json(silent=True) or {}
    ids = data.get("ids")

    if not isinstance(ids, list) or not ids or any(
        not isinstance(item, str) for item in ids
    ):
        return jsonify(message="Select valid history entries."), 400

    records = load_history()
    selected = [r for r in records if r["id"] in ids]

    if len(selected) != len(set(ids)):
        return jsonify(message="Unknown history entry. Nothing deleted."), 404

    remaining = [r for r in records if r["id"] not in ids]

    # Update the index before removing image files.
    INDEX_FILE.write_text(json.dumps(remaining, indent=2))

    for record in selected:
        filename = record["filename"]
        if Path(filename).name == filename:
            (IMAGES_DIR / filename).unlink(missing_ok=True)

    return jsonify(message=f"Deleted {len(selected)} history entries.")


if __name__ == "__main__":
    app.run(
        host=os.environ.get("BROTHER_STUDIO_HOST", "127.0.0.1"),
        port=int(os.environ.get("BROTHER_STUDIO_PORT", "5000")),
        debug=False
    )
