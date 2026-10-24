FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Les VITE_* sont figées à la compilation (voir docker-compose.yml, build.args).
ARG VITE_API_BASE
ARG VITE_VIDEO_URL
ARG VITE_THANKYOU_VIDEO_URL
ARG VITE_WHATSAPP_GROUP_URL
ARG VITE_LEGAL_URL
ARG VITE_PRIVACY_URL
ARG VITE_TERMS_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
