FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client tzdata

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate && npm run seed:js && npm run start:prod"]
