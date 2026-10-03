FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/package.json
COPY Frontend/package.json ./Frontend/package.json
RUN npm ci --workspace Backend --include-workspace-root=false --no-audit --no-fund
COPY Backend ./Backend
RUN npm --workspace Backend run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/package.json
COPY Frontend/package.json ./Frontend/package.json
RUN npm ci --workspace Backend --include-workspace-root=false --omit=dev --no-audit --no-fund
COPY --from=build /app/Backend/dist ./Backend/dist
COPY Backend/db ./Backend/db
WORKDIR /app/Backend
USER node
EXPOSE 3211
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/server.js"]
