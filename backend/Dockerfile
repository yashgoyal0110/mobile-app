# TirthRide API — production container for Google Cloud Run
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install runtime deps first for better layer caching
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# App code
COPY . .

# Cloud Run injects $PORT (defaults to 8080). Bind to it.
ENV PORT=8080
EXPOSE 8080

# Single worker keeps the in-process WebSocket connection manager consistent.
# Scale out with Cloud Run instances, not in-process workers.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 65"]
