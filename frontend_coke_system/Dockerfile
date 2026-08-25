ARG NODE_IMAGE_TAG=22-bookworm-slim
FROM node:${NODE_IMAGE_TAG}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
