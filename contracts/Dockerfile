FROM node:14-alpine as build

WORKDIR /usr/src/contracts

RUN apk add git

# Add source
COPY . .

RUN yarn install --pure-lockfile

ENTRYPOINT ["/usr/src/contracts/entrypoint.sh"]
