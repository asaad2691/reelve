# Reelve

Reelve is a Flask-based editor that blends a CapCut-style auto-cut workflow with Canva-style post design. It supports video and image editing, templates, a post designer with drag-and-drop layers, and a basic video timeline.

## Features
- AutoCut video silence detection
- Video edits: trim, speed, resize, text overlay, filters, brightness/contrast
- Image edits: resize, crop, filters, brightness/contrast, blur, text
- Templates: built-in + custom template builder
- Post Designer: layers, shapes, text tools, drawing tools, export PNG
- Video Timeline: upload multiple clips, drag to order, trim, export

## Screens
- `/` Home
- `/editor` AutoCut + quick edits
- `/templates` Template library
- `/post` Post Designer
- `/video` Video Timeline
- `/studio` Studio hub

## Quick Start
1. Create a venv and install deps:

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
```

2. Copy env:

```bash
copy .env.example .env
```

3. Run:

```bash
python app.py
```

## Requirements
- Python 3.10+
- FFmpeg in PATH (required by MoviePy)

## Notes
- Large uploads are allowed via `MAX_CONTENT_LENGTH` in `.env`.
- Templates are stored in `data/templates.json`.

## Project Structure
- `app.py` Flask app and routes
- `utils/` media processing and templates
- `templates/` HTML views
- `static/` CSS, JS, images
- `uploads/` runtime uploads (gitignored)
- `outputs/` exported media (gitignored)

## License
MIT
