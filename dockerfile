FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy both backend API code and shared ML package.
COPY backend ./backend
COPY ml ./ml

# Set environment variables
ENV PORT=8000
# Add /app to the python path so it can find the 'ml' module
ENV PYTHONPATH=/app 

EXPOSE 8000

WORKDIR /app/backend

# Run with gunicorn + uvicorn workers for better production performance
CMD ["gunicorn", "--worker-class", "uvicorn.workers.UvicornWorker", "--workers", "2", "--bind", "0.0.0.0:8000", "backend:app"]