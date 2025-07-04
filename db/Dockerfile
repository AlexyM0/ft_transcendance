FROM alpine:3.20
RUN apk add --no-cache sqlite          # installe sqlite 3.50.2 :contentReference[oaicite:1]{index=1}
VOLUME /data
WORKDIR /data
CMD ["sqlite3", "main.db"]
