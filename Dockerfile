FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

RUN ln -sf /app/.medusa/server/public /app/public

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]