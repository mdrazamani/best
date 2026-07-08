FROM node:20-alpine

WORKDIR /workspace

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apk add --no-cache \
  postgresql-client \
  tzdata \
  openssl \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY vendor/npm-cache ./vendor/npm-cache
COPY apps/api/package*.json ./apps/api/
WORKDIR /workspace/apps/api
RUN npm ci --offline --cache ../../vendor/npm-cache --prefer-offline --no-audit --fund=false

WORKDIR /workspace
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api ./apps/api

WORKDIR /workspace/apps/api
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate && npm run seed:js && npm run start:prod"]
