from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Dict, Optional, Tuple
import tempfile

import numpy as np
import cv2
from moviepy.editor import (
    AudioFileClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
    VideoFileClip,
    concatenate_videoclips,
    vfx,
)
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from utils.templates import load_templates

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}


def safe_filename(name: str) -> str:
    keep = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    return "".join([c for c in name if c in keep]) or "upload"


def is_video_file(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_EXTS


def _apply_template_edits(edits: Dict, template_id: Optional[str], template_store: Path, media: str) -> Dict:
    if not template_id:
        return edits
    templates = load_templates(template_store)
    found = next((t for t in templates if t["id"] == template_id), None)
    if not found:
        return edits
    template_edits = found.get("config", {}).get(media, {})
    merged = {**template_edits, **edits}
    return merged


def autocut_video(input_path: Path, output_path: Path, silence_threshold: float = 0.02, min_clip: float = 1.0):
    """
    Simple silence-based autocut.
    - Scans audio RMS per second
    - Keeps segments above threshold
    """
    clip = VideoFileClip(str(input_path))
    if clip.audio is None:
        clip.write_videofile(str(output_path), codec="libx264", audio_codec="aac")
        clip.close()
        return

    audio = AudioFileClip(str(input_path))
    duration = int(math.floor(audio.duration))
    keep_ranges = []
    start = None

    for t in range(duration):
        frame = audio.subclip(t, min(t + 1, audio.duration)).to_soundarray(fps=44100)
        rms = np.sqrt(np.mean(frame**2)) if frame.size else 0
        if rms >= silence_threshold:
            if start is None:
                start = t
        else:
            if start is not None:
                if t - start >= min_clip:
                    keep_ranges.append((start, t))
                start = None

    if start is not None:
        keep_ranges.append((start, min(audio.duration, duration)))

    if not keep_ranges:
        clip.write_videofile(str(output_path), codec="libx264", audio_codec="aac")
        clip.close()
        audio.close()
        return

    subclips = [clip.subclip(s, e) for s, e in keep_ranges]
    final = concatenate_videoclips(subclips)
    final.write_videofile(str(output_path), codec="libx264", audio_codec="aac")

    final.close()
    clip.close()
    audio.close()


def apply_video_edits(input_path: Path, output_path: Path, edits: Dict, template_id: Optional[str], template_store: Path):
    edits = _apply_template_edits(edits, template_id, template_store, "video")
    clip = VideoFileClip(str(input_path))

    if edits.get("filter") == "vivid":
        edits.setdefault("brightness", 1.1)
        edits.setdefault("contrast", 1.1)
        edits.setdefault("saturation", 1.15)
    elif edits.get("filter") == "cinematic":
        edits.setdefault("contrast", 1.2)
        edits.setdefault("brightness", 0.98)
        edits.setdefault("saturation", 0.9)

    if "trim" in edits:
        start, end = edits["trim"]
        clip = clip.subclip(start, end)

    if "speed" in edits:
        clip = clip.fx(vfx.speedx, edits["speed"])

    if "resize" in edits:
        w, h = edits["resize"]
        clip = clip.resize(newsize=(w, h))

    if "brightness" in edits:
        clip = clip.fx(vfx.colorx, float(edits["brightness"]))

    if "saturation" in edits:
        sat = float(edits["saturation"])

        def _sat_frame(frame):
            hsv = cv2.cvtColor(frame, cv2.COLOR_RGB2HSV).astype(np.float32)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sat, 0, 255)
            return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)

        clip = clip.fl_image(_sat_frame)

    if "contrast" in edits:
        contrast = float(edits["contrast"])
        if contrast != 1.0:
            contrast_value = int((contrast - 1.0) * 100)
            clip = clip.fx(vfx.lum_contrast, contrast=contrast_value)

    if "text" in edits:
        text = str(edits["text"])
        # Avoid ImageMagick dependency by rendering text with PIL to a transparent PNG.
        overlay_size = clip.size
        font_size = int(edits.get("font_size", 48))
        color = edits.get("text_color", "white")
        pos = tuple(edits.get("text_pos", [20, 20]))
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        img = Image.new("RGBA", overlay_size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except OSError:
            font = ImageFont.load_default()
        draw.text(pos, text, font=font, fill=color)
        img.save(tmp_path)
        text_overlay = ImageClip(str(tmp_path)).set_duration(clip.duration)
        clip = CompositeVideoClip([clip, text_overlay])

    if "overlay" in edits and Path(edits["overlay"]).exists():
        overlay = ImageClip(edits["overlay"]).set_duration(clip.duration).set_position((0, 0))
        clip = CompositeVideoClip([clip, overlay])

    clip.write_videofile(str(output_path), codec="libx264", audio_codec="aac")
    clip.close()


def apply_image_edits(input_path: Path, output_path: Path, edits: Dict, template_id: Optional[str], template_store: Path):
    edits = _apply_template_edits(edits, template_id, template_store, "image")
    img = Image.open(input_path).convert("RGB")

    if "resize" in edits:
        img = img.resize(tuple(edits["resize"]))

    if "crop" in edits:
        img = img.crop(tuple(edits["crop"]))

    if edits.get("filter") == "vivid":
        edits.setdefault("brightness", 1.1)
        edits.setdefault("contrast", 1.1)
        edits.setdefault("saturation", 1.15)
    elif edits.get("filter") == "cinematic":
        edits.setdefault("contrast", 1.2)
        edits.setdefault("brightness", 0.98)
        edits.setdefault("saturation", 0.9)

    # Apply in a consistent order to match preview (brightness -> contrast -> saturation)
    if "brightness" in edits:
        img = ImageEnhance.Brightness(img).enhance(float(edits["brightness"]))
    if "contrast" in edits:
        img = ImageEnhance.Contrast(img).enhance(float(edits["contrast"]))
    if "saturation" in edits:
        img = ImageEnhance.Color(img).enhance(float(edits["saturation"]))

    if edits.get("blur"):
        img = img.filter(ImageFilter.GaussianBlur(radius=float(edits["blur"])))

    if "text" in edits:
        text = str(edits["text"])
        font_size = int(edits.get("font_size", 48))
        color = edits.get("text_color", "white")
        pos = tuple(edits.get("text_pos", [20, 20]))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except OSError:
            font = ImageFont.load_default()
        draw.text(pos, text, font=font, fill=color)

    img.save(output_path)


def stitch_videos(paths, timeline, output_path: Path):
    clips = []
    for idx, path in enumerate(paths):
        if not path.exists():
            continue
        clip = VideoFileClip(str(path))
        # Optional trim from timeline
        entry = next((t for t in timeline if t.get("index") == idx), None)
        if entry and "trim" in entry:
            start, end = entry["trim"]
            clip = clip.subclip(start, end)
        clips.append(clip)

    if not clips:
        return
    final = concatenate_videoclips(clips, method="compose")
    final.write_videofile(str(output_path), codec="libx264", audio_codec="aac")
    final.close()
    for c in clips:
        c.close()
