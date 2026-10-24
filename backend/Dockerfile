FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

COPY package.json ./

# pnpm-lock.yaml lives at the workspace root, outside this build context, so the lockfile cannot be frozen; pnpm@9 is pinned because pnpm 10 skips dependency build scripts such as prisma's
RUN pnpm install --no-frozen-lockfile

COPY prisma ./prisma/

RUN pnpm run prisma:generate

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

COPY . .

EXPOSE 8901

CMD ["/bin/sh", "/app/entrypoint.sh"]
