# Home server — imagen del sitio + panel (Node, sin Cloudflare).
# Los datos (sqlite + PDFs) viven FUERA de la imagen, en el volumen /app/data.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 trae prebuilds para linux x64/arm64 glibc — sin toolchain.
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
# El esquema se aplica solo al primer arranque (lib/homeBindings.ts).
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
