from __future__ import annotations

import io
import os
import re
import threading
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads")).resolve()
MODEL_PATH = os.getenv("MODEL_PATH", "/app/model/mobilenetv2-12.onnx")
PRODUCT_ID = re.compile(r"^[0-9a-fA-F-]{36}$")
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024
app = FastAPI(title="BTMI Visual Search", docs_url=None, redoc_url=None)
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
cache: dict[str, tuple[int, int, np.ndarray]] = {}
cache_lock = threading.Lock()


def preprocess(image: Image.Image) -> np.ndarray:
    image = ImageOps.fit(ImageOps.exif_transpose(image).convert("RGB"), (224, 224), method=Image.Resampling.LANCZOS)
    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - np.asarray([0.485, 0.456, 0.406], dtype=np.float32)) / np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
    return np.transpose(array, (2, 0, 1))[None, ...]


def embedding(image: Image.Image) -> np.ndarray:
    output = np.asarray(session.run(None, {input_name: preprocess(image)})[0], dtype=np.float32).reshape(-1)
    output -= output.max(initial=0)
    vector = np.exp(output)
    norm = np.linalg.norm(vector)
    return vector / norm if norm else vector


def cached_embedding(path: Path) -> np.ndarray | None:
    try:
        stat, key = path.stat(), str(path)
        with cache_lock:
            current = cache.get(key)
        if current and current[0] == stat.st_mtime_ns and current[1] == stat.st_size:
            return current[2]
        with Image.open(path) as image:
            vector = embedding(image)
        with cache_lock:
            cache[key] = (stat.st_mtime_ns, stat.st_size, vector)
        return vector
    except (OSError, UnidentifiedImageError, ValueError):
        return None


def catalogue_images():
    products = UPLOAD_DIR / "products"
    if not products.exists():
        return
    for directory in products.iterdir():
        if not directory.is_dir() or not PRODUCT_ID.match(directory.name):
            continue
        for path in directory.iterdir():
            if path.is_file() and path.suffix.lower() in ALLOWED_SUFFIXES:
                yield directory.name, path


@app.get("/health")
def health():
    return {"status": "ok", "model": "mobilenetv2-12"}


@app.post("/search")
async def search(image: UploadFile = File(...), top_k: int = Form(20)):
    content = await image.read(MAX_IMAGE_BYTES + 1)
    if not content or len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Invalid image size")
    try:
        with Image.open(io.BytesIO(content)) as query_image:
            query = embedding(query_image)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image")
    best: dict[str, float] = {}
    for product_id, path in catalogue_images() or []:
        candidate = cached_embedding(path)
        if candidate is None or candidate.shape != query.shape:
            continue
        score = float(np.dot(query, candidate))
        if score > best.get(product_id, -1.0):
            best[product_id] = score
    matches = sorted(best.items(), key=lambda item: item[1], reverse=True)[:max(1, min(int(top_k), 30))]
    return {"matches": [{"product_id": product_id, "score": round(score, 6)} for product_id, score in matches]}
