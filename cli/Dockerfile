FROM ghcr.io/puppeteer/puppeteer:latest

COPY package.json .

USER root
RUN apt-get update && apt-get install -y xauth
USER pptruser

RUN npm install

COPY . .

USER root
RUN apt-get update && apt-get install -y libx11-xcb1 usbutils
USER pptruser

CMD echo "built successfully" && tail -f /dev/null
# CMD echo "built successfully"
