FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=${VITE_API_BASE}
ARG VITE_TOMTOM_API_KEY=
ENV VITE_TOMTOM_API_KEY=${VITE_TOMTOM_API_KEY}
# Public path of the built files: "/" when served alone, "/admin-console/"
# when the website (the Expo app) forwards its /admin console here.
ARG VITE_BASE=/
ARG CACHE_BUST=1
RUN echo "Cache bust: ${CACHE_BUST}" && npm run build -- --base=${VITE_BASE}

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]