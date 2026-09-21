# Multi-stage: Vite React SPA → nginx (shop-web)
# Stage 1: build
FROM node:20.19-alpine AS build

WORKDIR /frontend

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Stage 2: nginx runtime (unprivileged listen on 8080; Helm Service still exposes 80)
FROM nginx:1.27-alpine AS runtime

# Only substitute API_UPSTREAM so nginx $uri / $host stay intact
ENV API_UPSTREAM=shop:5000 \
    NGINX_ENVSUBST_FILTER=API_UPSTREAM

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d \
    && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run /etc/nginx/conf.d /etc/nginx/templates

COPY --chown=nginx:nginx nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=nginx:nginx /frontend/dist /usr/share/nginx/html

# Non-root (nginx UID 101). Port 8080 avoids NET_BIND_SERVICE (Checkov CKV_K8S_25).
USER nginx

# Container listens 8080; Helm Service port remains 80 → targetPort 8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

# Keep image ENTRYPOINT (envsubst on templates) + nginx
CMD ["nginx", "-g", "daemon off;"]
