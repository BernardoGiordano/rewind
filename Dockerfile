FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist/ dist/

EXPOSE 4000

CMD ["node", "dist/rewind/server/server.mjs"]
