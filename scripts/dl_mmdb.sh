#!/bin/sh

curl -o /tmp/mmdb.tar.gz -L https://web.archive.org/web/20191227182412/https://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz
rm -rf /tmp/mmdb > /dev/null 2>&1
mkdir -p /tmp/mmdb
tar -xf /tmp/mmdb.tar.gz -C /tmp/mmdb --strip-components 1
cp /tmp/mmdb/GeoLite2-Country.mmdb src/helper/geo.mmdb
