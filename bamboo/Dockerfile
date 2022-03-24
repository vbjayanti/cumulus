## Dockerfile to create integration/unit test environment
FROM node:10.24.0
RUN apt update && npm config set unsafe-perm true &&\
    apt install -y netcat zip jq rsync zip python-pip && \
    apt-get install -y python-pip && pip install awscli && \
    npm install -g npm