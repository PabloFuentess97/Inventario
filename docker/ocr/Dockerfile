# Microservicio de OCR (PP-OCRv5 latino sobre ONNX Runtime, solo CPU)
FROM python:3.11-slim

# opencv (dependencia de rapidocr) necesita estas librerías del sistema
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-descargar los modelos EN LA IMAGEN: el contenedor no necesita internet
# en tiempo de ejecución (importante en despliegues con red restringida).
RUN python - <<'PY'
from rapidocr import RapidOCR, LangRec, ModelType, OCRVersion
RapidOCR(params={
    "Rec.lang_type": LangRec.LATIN,
    "Rec.ocr_version": OCRVersion.PPOCRV5,
    "Rec.model_type": ModelType.MOBILE,
})
print("Modelos OCR descargados en la imagen")
PY

COPY servidor.py .

EXPOSE 8000
CMD ["uvicorn", "servidor:app", "--host", "0.0.0.0", "--port", "8000"]
