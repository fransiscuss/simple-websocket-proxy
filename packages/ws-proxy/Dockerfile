FROM node:20-alpine AS builder

RUN npm install -g pnpm@8.0.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
RUN pnpm install

COPY src/ src/
COPY prisma/ prisma/
RUN pnpm run db:generate
RUN pnpm run build

FROM node:20-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

CMD ["node", "dist/index.js"]