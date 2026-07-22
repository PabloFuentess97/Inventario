# -*- coding: utf-8 -*-
"""
Microservicio de OCR de alta precisión (PaddleOCR PP-OCRv5 vía RapidOCR/ONNX).

Corre como servicio interno de docker-compose (sin puertos públicos): la app
Next.js le reenvía las fotos desde /api/ocr. El modelo de reconocimiento es el
LATINO (español con tildes incluido) y lee mucho mejor que tesseract en fotos
reales de móvil: ángulos, brillos, desenfoque…

Endpoints:
  GET  /health  → sonda para el healthcheck de Docker
  POST /ocr     → multipart con campo "imagen"; responde {texto, confianza, lineas}
"""
import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps
from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

MAX_BYTES = 15 * 1024 * 1024
MAX_LADO = 2000  # las fotos ya llegan comprimidas del móvil; esto es un tope

app = FastAPI(title="OCR Inventario")

# Un único motor compartido (thread-safe para inferencia secuencial de uvicorn)
motor = RapidOCR(
    params={
        "Rec.lang_type": LangRec.LATIN,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "Rec.model_type": ModelType.MOBILE,
    }
)


@app.get("/health")
def health():
    return {"ocr": "ok"}


@app.post("/ocr")
async def ocr(imagen: UploadFile = File(...)):
    contenido = await imagen.read()
    if not contenido:
        raise HTTPException(400, "Imagen vacía")
    if len(contenido) > MAX_BYTES:
        raise HTTPException(413, "Imagen demasiado grande")

    try:
        img = Image.open(io.BytesIO(contenido))
        img = ImageOps.exif_transpose(img)  # respetar orientación EXIF
        img = img.convert("RGB")
        if max(img.size) > MAX_LADO:
            img.thumbnail((MAX_LADO, MAX_LADO))
    except Exception:
        raise HTTPException(415, "El archivo no es una imagen válida")

    resultado = motor(np.array(img))

    if resultado is None or not resultado.txts:
        return {"texto": "", "confianza": 0, "lineas": []}

    lineas = [
        {"texto": t, "confianza": round(float(s) * 100, 1)}
        for t, s in zip(resultado.txts, resultado.scores)
    ]
    confianza_media = sum(l["confianza"] for l in lineas) / len(lineas)
    return {
        "texto": "\n".join(l["texto"] for l in lineas),
        "confianza": round(confianza_media, 1),
        "lineas": lineas,
    }
