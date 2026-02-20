FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "start:dev"]
