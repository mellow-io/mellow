#!/bin/sh

EXE_FILE=core
CONFIG_FILE=cfg.json
GEOSITE_FILE=geosite.dat
GEOMMDB_FILE=geo.mmdb
DNS1=8.8.8.8
DNS2=8.8.4.4
TUN_GW=10.255.0.1
TUN_ADDR=10.255.0.2
TUN_MASK=255.255.255.0
ORIG_GW=`ip route get 1 | awk '{print $3;exit}'`
ORIG_ST_SCOPE=`ip route get 1 | awk '{print $5;exit}'`
ORIG_ST=`ip route get 1 | awk '{print $7;exit}'`

if [ ! -z "$1" ]; then
	CONFIG_FILE=$1
fi

if [ `id -u` -ne 0 ]; then
  echo 'Must run as root!'
  exit 1
fi

if [ ! -f "$EXE_FILE" ]; then
	echo "Executable file not found!"
	exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
	echo "Config file not found!"
	exit 1
fi

if [ ! -x "$EXE_FILE" ]; then
	echo "Run 'chmod +x $EXE_FILE' first!"
	exit 1
fi

function ask_data_file {
	while true; do
		read -p "$1 not found! Feel free to skip if you are sure your config does not depend on this file. Do you wish to proceed this program?" yn
		case $yn in
			[Yy]* ) break;;
			[Nn]* ) exit 1;;
			* ) echo "Please answer yes or no.";;
		esac
	done
}

if [ ! -f "$GEOSITE_FILE" ]; then
	ask_data_file $GEOSITE_FILE
fi

if [ ! -f "$GEOMMDB_FILE" ]; then
	ask_data_file $GEOMMDB_FILE
fi

echo -e "Detected send through address: \e[92m$ORIG_ST\e[0m <------------- \e[91mMake sure this is an IP address, otherwise you're in trouble.\e[0m"
echo -e "Detected send through scope: \e[92m$ORIG_ST_SCOPE\e[0m <--------- \e[91mThis should be a network interface name.\e[0m"
echo -e "Detected original gateway: \e[92m$ORIG_GW\e[0m <----------------- \e[91mThis should be an IP address.\e[0m"

if [ -f `which realpath` ]; then
  CONFIG_FULL_PATH=`realpath $CONFIG_FILE`
  echo -e "Using config file \e[92m$CONFIG_FULL_PATH\e[0m"
fi

config_dns() {
	if [ ! -d "/tmp/mellow" ]; then
		mkdir /tmp/mellow
	fi
	cp /etc/resolv.conf /tmp/mellow/resolv.conf
	echo "nameserver $DNS1" > /etc/resolv.conf
	echo "nameserver $DNS2" >> /etc/resolv.conf
	echo -e "Using DNS \e[92m$DNS1, $DNS2\e[0m"
}

recover_dns() {
	cp /tmp/mellow/resolv.conf /etc/resolv.conf
	echo "DNS recovered."
}

config_route() {
  # Give some time for Mellow to open the TUN device.
  sleep 3
  ip route del default table main
  ip route add default via $TUN_GW table main
  ip route add default via $ORIG_GW dev $ORIG_ST_SCOPE table default
  ip rule add from $ORIG_ST table default
  echo "Routing table is ready."
}

recover_route() {
  ip rule del from $ORIG_ST table default
  ip route del default table default
  ip route del default table main
  ip route add default via $ORIG_GW table main
  echo "Routing table recovered."
}

config_dns

# Configure the routing table in the background.
config_route &


EXE_FULL_PATH=`realpath $EXE_FILE`

# Run Mellow in blocking mode.
$EXE_FULL_PATH \
-tunAddr $TUN_ADDR \
-tunGw $TUN_GW \
-tunMask $TUN_MASK \
-sendThrough $ORIG_ST \
-vconfig $CONFIG_FILE \
-proxyType v2ray \
-udpTimeout 1m0s \
-relayICMP \
-loglevel info

# Recover the routing table after Mellow exits.
recover_route

recover_dns
