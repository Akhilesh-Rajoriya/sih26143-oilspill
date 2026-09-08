FROM python:3.11-slim

# Install system dependencies for GDAL, OpenCV headless, and GIS rasters
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    gdal-bin \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Set up user
RUN useradd -m -u 1000 user
WORKDIR /app

# Install lightweight PyTorch CPU wheel first to keep image small & fast to build
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files, models, and pre-built frontend
COPY app/ app/
COPY models/ models/
COPY data/ data/
COPY schemas.py .
COPY drift_model.py .
COPY ais_spill_scoring.py .
COPY frontend/dist/ frontend/dist/

# Set ownership to user
RUN chown -R user:user /app
USER user

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

