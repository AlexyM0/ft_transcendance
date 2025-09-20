FROM	debian:bullseye

RUN		apt-get update -y && apt-get upgrade -y
RUN		apt-get install -y nginx
RUN		apt-get install -y openssl

RUN		mkdir -p /etc/nginx/ssl
RUN		mkdir -p /var/run/nginx
RUN		openssl req -x509 -nodes -out /etc/nginx/ssl/inception.crt -keyout /etc/nginx/ssl/inception.key \
		-subj "/C=FR/ST=IDF/L=Paris/O=42/OU=42/CN=qliso.42.fr/UID=qliso"

COPY		./nginx.conf /etc/nginx/nginx.conf

EXPOSE		443

CMD		["nginx"]