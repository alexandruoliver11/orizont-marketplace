FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]