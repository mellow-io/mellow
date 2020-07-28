#!/bin/sh

if [ `id -u` -ne 0 ]; then
  echo 'Must run as root!'
  exit 1
fi


EXE_FILE=core
CONFIG_FILE=cfg.json

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

GEOSITE_FILE=geosite.dat
GEOMMDB_FILE=geo.mmdb

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

TUN_GW=10.255.0.1
TUN_ADDR=10.255.0.2
TUN_MASK=255.255.255.0
ORIG_GW=`ip route get 1 | awk '{print $3;exit}'`
ORIG_ST_SCOPE=`ip route get 1 | awk '{print $5;exit}'`
ORIG_ST=`ip route get 1 | awk '{print $7;exit}'`

echo "Original send through address $ORIG_ST (It should be a valid IP address)"
echo "Original send through scope $ORIG_ST_SCOPE (It should be a valid network interface name)"
echo "Original gateway $ORIG_GW (It should be a valid IP address)"

if [ -f `which realpath` ]; then
  CONFIG_FULL_PATH=`realpath $CONFIG_FILE`
  echo "Using config file $CONFIG_FULL_PATH"
fi

config_route() {
  # Give some time for Mellow to open the TUN device.
  sleep 3
  echo 'Setting up routing table...'
  ip route del default table main
  ip route add default via $TUN_GW table main
  ip route add default via $ORIG_GW dev $ORIG_ST_SCOPE table default
  ip rule add from $ORIG_ST table default
}

recover_route() {
  echo 'Recovering routing table...'
  ip rule del from $ORIG_ST table default
  ip route del default table default
  ip route del default table main
  ip route add default via $ORIG_GW table main
}

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
