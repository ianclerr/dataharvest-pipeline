FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm ci --include=dev

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]