FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Fix admin build path - Medusa looks in .medusa/admin but builds to .medusa/server/public/admin
RUN if [ -d ".medusa/server/public/admin" ] && [ ! -d ".medusa/admin" ]; then \
      cp -r .medusa/server/public/admin .medusa/admin; \
    fi

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]