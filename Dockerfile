FROM ubuntu:18.04

RUN apt-get update && \
  apt-get install git npm nodejs -y

WORKDIR /work

ADD . /work/
RUN npm install papaparse influx axios

ENTRYPOINT ["node", "/work/app.js"]
