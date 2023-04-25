FROM node:latest
WORKDIR /app

COPY src/ /app/

RUN npm i
ENTRYPOINT [ "node", "src/app.js" ]