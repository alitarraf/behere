FROM node:22-alpine
RUN apk add --no-cache tzdata
WORKDIR /srv/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY app/ /srv/app/
CMD ["node", "index.js"]
