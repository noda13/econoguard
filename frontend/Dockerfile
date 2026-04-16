FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json ./

RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 3901

CMD ["pnpm", "run", "dev"]
