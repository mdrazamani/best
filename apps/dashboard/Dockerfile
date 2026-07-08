FROM node:20-alpine AS build

WORKDIR /workspace

COPY vendor/npm-cache ./vendor/npm-cache
COPY apps/dashboard/package*.json ./apps/dashboard/
WORKDIR /workspace/apps/dashboard
RUN npm ci --offline --cache ../../vendor/npm-cache --prefer-offline --no-audit --fund=false

WORKDIR /workspace
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/dashboard ./apps/dashboard

WORKDIR /workspace/apps/dashboard
RUN npm run build

FROM nginx:1.27-alpine

COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/dashboard/dist /usr/share/nginx/html

EXPOSE 80
