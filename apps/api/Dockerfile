FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/scripts ./apps/api/scripts

WORKDIR /app/apps/api
RUN npm ci

WORKDIR /app
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app/apps/api
ENV NODE_ENV=production

RUN apk add --no-cache openssl ca-certificates
RUN addgroup -S arzmix && adduser -S arzmix -G arzmix

COPY --from=builder --chown=arzmix:arzmix /app/apps/api/dist ./dist
COPY --from=builder --chown=arzmix:arzmix /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=arzmix:arzmix /app/apps/api/package.json ./package.json
COPY --from=builder --chown=arzmix:arzmix /app/apps/api/prisma ./prisma
COPY --from=builder --chown=arzmix:arzmix /app/apps/api/scripts ./scripts
COPY --from=builder --chown=arzmix:arzmix /app/apps/api/tsconfig.seed.json ./tsconfig.seed.json
COPY --from=builder --chown=arzmix:arzmix /app/tsconfig.base.json /app/tsconfig.base.json

COPY --chown=arzmix:arzmix apps/api/docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER arzmix

CMD ["./entrypoint.sh"]
