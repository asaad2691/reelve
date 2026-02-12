from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

DEFAULT_TEMPLATES = [
    {
        "id": "social-short",
        "name": "Social Short",
        "config": {
            "video": {"resize": [1080, 1920], "speed": 1.05, "text": "@yourbrand"},
            "image": {"resize": [1080, 1080], "filter": "vivid"},
        },
    },
    {
        "id": "cinematic",
        "name": "Cinematic",
        "config": {
            "video": {"resize": [1920, 1080], "contrast": 1.1, "brightness": 1.05},
            "image": {"filter": "cinematic"},
        },
    },
    {
        "id": "square-promo",
        "name": "Square Promo",
        "config": {
            "video": {"resize": [1080, 1080], "speed": 1.0, "text": "New Drop"},
            "image": {"resize": [1080, 1080], "filter": "vivid"},
        },
    },
    {
        "id": "neon-pop",
        "name": "Neon Pop",
        "config": {
            "video": {"resize": [1080, 1920], "speed": 1.15, "text": "NEW", "contrast": 1.2, "brightness": 1.15},
            "image": {"filter": "vivid", "contrast": 1.2, "brightness": 1.1},
        },
    },
    {
        "id": "vlog-clean",
        "name": "Vlog Clean",
        "config": {
            "video": {"resize": [1920, 1080], "speed": 1.0, "text": "VLOG", "brightness": 1.05},
            "image": {"brightness": 1.05, "contrast": 1.05},
        },
    },
    {
        "id": "moody-dark",
        "name": "Moody Dark",
        "config": {
            "video": {"contrast": 1.25, "brightness": 0.9},
            "image": {"contrast": 1.25, "brightness": 0.9},
        },
    },
    {
        "id": "bright-ads",
        "name": "Bright Ads",
        "config": {
            "video": {"brightness": 1.2, "contrast": 1.1, "text": "SALE"},
            "image": {"brightness": 1.2, "contrast": 1.1},
        },
    },
    {
        "id": "soft-film",
        "name": "Soft Film",
        "config": {
            "video": {"brightness": 1.05, "contrast": 0.95},
            "image": {"brightness": 1.05, "contrast": 0.95, "blur": 0.5},
        },
    },
]


def default_templates():
    return DEFAULT_TEMPLATES


def load_templates(store_path: Path) -> List[Dict]:
    templates = list(DEFAULT_TEMPLATES)
    if store_path.exists():
        try:
            data = json.loads(store_path.read_text(encoding="utf-8"))
            templates.extend(data)
        except json.JSONDecodeError:
            pass
    return templates


def save_template(store_path: Path, name: str, config: Dict) -> Dict:
    template = {
        "id": name.lower().replace(" ", "-") + "-custom",
        "name": name,
        "config": config,
    }
    existing = []
    if store_path.exists():
        try:
            existing = json.loads(store_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []
    existing.append(template)
    store_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    return template
