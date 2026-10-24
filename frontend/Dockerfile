FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json ./

# pnpm-lock.yaml lives at the workspace root, outside this build context, so the lockfile cannot be frozen; pnpm@9 is pinned because pnpm 10 skips dependency build scripts
RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 3901

CMD ["pnpm", "run", "dev"]
