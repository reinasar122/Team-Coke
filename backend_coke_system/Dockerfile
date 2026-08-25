ARG PYTHON_IMAGE_TAG=3.12-slim-bookworm
FROM python:${PYTHON_IMAGE_TAG} AS builder

ENV VIRTUAL_ENV=/opt/venv PATH="/opt/venv/bin:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends default-libmysqlclient-dev gcc pkg-config && rm -rf /var/lib/apt/lists/* && python -m venv "$VIRTUAL_ENV"
WORKDIR /build
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM python:${PYTHON_IMAGE_TAG}

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 VIRTUAL_ENV=/opt/venv PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libmariadb3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN mkdir -p /app/media /app/staticfiles
CMD ["gunicorn", "backend_coke_system.wsgi:application", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
