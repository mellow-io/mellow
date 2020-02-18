#!/bin/sh
# Original Address is broken http://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz
# The source comes from here: https://github.com/Dreamacro/maxmind-geoip

# curl -o /tmp/mmdb.tar.gz -L http://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz
# rm -rf /tmp/mmdb > /dev/null 2>&1
# mkdir -p /tmp/mmdb
# tar -xf /tmp/mmdb.tar.gz -C /tmp/mmdb --strip-components 1
# cp /tmp/mmdb/GeoLite2-Country.mmdb src/helper/geo.mmdb

curl -o /tmp/geo.mmdb -L https://github.com/Dreamacro/maxmind-geoip/releases/download/latest/Country.mmdb
cp /tmp/geo.mmdb src/helper/geo.mmdb
rm -f /tmp/geo.mmdb