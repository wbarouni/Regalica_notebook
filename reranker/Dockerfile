FROM python:3.12-slim

WORKDIR /app

# Upgrade pip and install security updates, minimize installed packages
RUN apt-get update && \
    apt-get upgrade -y --with-new-pkgs && \
    apt-get install -y --no-install-recommends gcc curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip to latest version for security
RUN pip install --upgrade pip

# Copy requirements first for better caching
COPY requirements.txt .

# Preinstall CPU-only PyTorch and torchvision to avoid CUDA downloads, then other deps
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch==2.4.1 torchvision==0.19.1 && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD python -c "import requests; requests.get('http://localhost:8001/health')"

# Start the application
CMD ["python", "app.py"]
