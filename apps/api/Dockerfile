# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Prisma engines need OpenSSL on Alpine/musl
RUN apk add --no-cache openssl

# install workspace deps (api only)
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace apps/api --include-workspace-root

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# workspace deps are hoisted to the repo-root node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY apps/api/package.json ./package.json

EXPOSE 3000
# migrate + seed handled by compose command; default just starts the server
CMD ["node", "dist/src/main.js"]
