FROM node:22-alpine AS build

ARG APP_SUBPATH=/truss

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN VITE_BASE_PATH="${APP_SUBPATH}" npm run build

FROM nginx:1.27-alpine AS runtime

ARG APP_SUBPATH=/truss
ENV APP_SUBPATH=${APP_SUBPATH} \
    NGINX_ENVSUBST_FILTER=APP_SUBPATH

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html${APP_SUBPATH}/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1${APP_SUBPATH}/" || exit 1

CMD ["nginx", "-g", "daemon off;"]
