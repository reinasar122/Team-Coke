ARG NODE_IMAGE_TAG=22-bookworm-slim
ARG NGINX_IMAGE_TAG=1.27.5-alpine
FROM node:${NODE_IMAGE_TAG} AS frontend-build
WORKDIR /src
COPY frontend_coke_system/package.json frontend_coke_system/package-lock.json ./
RUN npm ci
COPY frontend_coke_system/ ./
RUN REACT_APP_API_BASE=/api PUBLIC_URL=/coke npm run build

ARG NGINX_IMAGE_TAG
FROM nginx:${NGINX_IMAGE_TAG}
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /src/build /usr/share/nginx/html/coke
