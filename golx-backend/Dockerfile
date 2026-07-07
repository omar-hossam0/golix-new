FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHON_BIN=/opt/goalix-model-venv/bin/python \
    RANKING_PYTHON_BIN=/opt/goalix-model-venv/bin/python \
    INJURY_RISK_PYTHON_BIN=/opt/goalix-model-venv/bin/python \
    RANKING_MODEL_DIR="/models/Ranking Model" \
    INJURY_RISK_MODEL_DIR=/models

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY golx-backend/package.json golx-backend/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY golx-backend/requirements-models.txt ./requirements-models.txt
RUN python3 -m venv /opt/goalix-model-venv \
    && /opt/goalix-model-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/goalix-model-venv/bin/pip install --no-cache-dir -r ./requirements-models.txt

COPY --chown=node:node golx-backend/ ./

RUN install -d -o node -g node ./uploads ./backups

EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
