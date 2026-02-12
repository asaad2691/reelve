from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, url_for

from utils.media import (
    apply_image_edits,
    apply_video_edits,
    autocut_video,
    is_video_file,
    safe_filename,
    stitch_videos,
)
from utils.templates import default_templates, load_templates, save_template

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / os.getenv("UPLOAD_FOLDER", "uploads")
OUTPUT_DIR = BASE_DIR / os.getenv("OUTPUT_FOLDER", "outputs")
TEMPLATE_STORE = BASE_DIR / os.getenv("TEMPLATE_STORE", "data/templates.json")

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TEMPLATE_STORE.parent.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev")
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_LENGTH", "1073741824"))


@app.route("/")
def index():
    return render_template("index.html", templates=load_templates(TEMPLATE_STORE))


@app.route("/editor")
def editor():
    return render_template("editor.html", templates=load_templates(TEMPLATE_STORE))


@app.route("/studio")
def studio():
    return render_template("studio.html")


@app.route("/post")
def post_designer():
    return render_template("post_designer.html")


@app.route("/video")
def video_editor():
    return render_template("video_editor.html")


@app.route("/templates")
def templates_page():
    return render_template("templates.html", templates=load_templates(TEMPLATE_STORE))


@app.route("/api/templates", methods=["GET", "POST"])
def templates_api():
    if request.method == "GET":
        return jsonify(load_templates(TEMPLATE_STORE))

    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    config = payload.get("config")
    if not name or not isinstance(config, dict):
        return jsonify({"error": "Invalid template"}), 400

    template = save_template(TEMPLATE_STORE, name, config)
    return jsonify(template)


@app.route("/process", methods=["POST"])
def process_media():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    filename = safe_filename(file.filename)
    ext = Path(filename).suffix.lower()
    upload_id = uuid.uuid4().hex
    upload_path = UPLOAD_DIR / f"{upload_id}{ext}"
    file.save(upload_path)

    mode = request.form.get("mode", "video")
    action = request.form.get("action", "edits")
    template_id = request.form.get("template")

    output_name = f"{upload_id}_out{ext if mode == 'image' else '.mp4'}"
    output_path = OUTPUT_DIR / output_name

    try:
        edits = json.loads(request.form.get("edits", "{}"))
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid edits JSON"}), 400

    print(f"[process] mode={mode} action={action} template={template_id} edits={edits}")

    if mode == "video" or is_video_file(upload_path):
        if action == "autocut":
            # Allow autocut with optional overrides from edits
            silence_threshold = float(edits.get("silence_threshold", 0.02))
            min_clip = float(edits.get("min_clip", 1.0))
            autocut_video(upload_path, output_path, silence_threshold=silence_threshold, min_clip=min_clip)
            # If other edits exist, apply them on top of autocut
            remaining_edits = {k: v for k, v in edits.items() if k not in {"silence_threshold", "min_clip"}}
            if remaining_edits:
                apply_video_edits(output_path, output_path, remaining_edits, template_id, TEMPLATE_STORE)
        else:
            apply_video_edits(upload_path, output_path, edits, template_id, TEMPLATE_STORE)
    else:
        apply_image_edits(upload_path, output_path, edits, template_id, TEMPLATE_STORE)

    return redirect(url_for("download", filename=output_name))


@app.route("/process-timeline", methods=["POST"])
def process_timeline():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files uploaded"}), 400

    try:
        timeline = json.loads(request.form.get("timeline", "[]"))
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid timeline JSON"}), 400

    saved_paths = []
    for idx, f in enumerate(files):
        if not f.filename:
            continue
        filename = safe_filename(f.filename)
        ext = Path(filename).suffix.lower()
        upload_id = uuid.uuid4().hex
        upload_path = UPLOAD_DIR / f"{upload_id}_{idx}{ext}"
        f.save(upload_path)
        saved_paths.append(upload_path)

    if not saved_paths:
        return jsonify({"error": "No valid files"}), 400

    output_name = f"{uuid.uuid4().hex}_timeline.mp4"
    output_path = OUTPUT_DIR / output_name
    stitch_videos(saved_paths, timeline, output_path)
    return redirect(url_for("download", filename=output_name))


@app.route("/download/<path:filename>")
def download(filename: str):
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)


@app.route("/templates/defaults")
def template_defaults():
    return jsonify(default_templates())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
