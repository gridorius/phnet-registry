FROM node:latest
WORKDIR /app

COPY src/ /app/src/
COPY package.json /app/

RUN npm i
ENTRYPOINT [ "node", "src/app.js" ]