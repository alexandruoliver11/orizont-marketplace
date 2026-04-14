FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

RUN echo "=== Admin build check ===" && \
    find .medusa -name "index.html" 2>/dev/null && \
    rm -rf .medusa/admin && \
    if [ -d ".medusa/server/public/admin" ] && [ -f ".medusa/server/public/admin/index.html" ]; then \
      cp -r .medusa/server/public/admin .medusa/admin && \
      echo "Admin build OK"; \
    else \
      echo "ERROR: index.html missing from admin build" && \
      find .medusa -type f 2>/dev/null && \
      exit 1; \
    fi

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]