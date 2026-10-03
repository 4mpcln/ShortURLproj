FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/package.json
COPY Frontend/package.json ./Frontend/package.json
RUN npm ci --workspace Frontend --include-workspace-root=false --no-audit --no-fund
COPY Frontend ./Frontend
# Browser requests use the same-origin /api proxy, not a Docker-only hostname.
ENV VITE_API_BASE_URL=""
RUN npm --workspace Frontend run build

FROM nginx:stable-alpine AS runtime
COPY Frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/Frontend/dist /usr/share/nginx/html
EXPOSE 3210
