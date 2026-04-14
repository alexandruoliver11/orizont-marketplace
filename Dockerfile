FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

RUN rm -rf .medusa/admin && cp -r .medusa/server/public/admin .medusa/admin

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]