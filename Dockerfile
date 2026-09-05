FROM python:3.11-slim

LABEL maintainer="https://github.com/marcuz-apl/temas"
LABEL description="TEMAS 2.0 - Turkey Earthquake Monitoring & Analysis System"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=4070

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY data/ ./data/
COPY VERSION pyproject.toml README.md ./

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4070/api/health || exit 1

EXPOSE 4070

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "4070"]
