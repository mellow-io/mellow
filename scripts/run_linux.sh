#!/bin/sh

CONFIG_FILE=cfg.json
TUN_GW=10.255.0.1
TUN_ADDR=10.255.0.2
TUN_MASK=255.255.255.0
ORIG_GW=`ip route get 1 | awk '{print $3;exit}'`
ORIG_ST_SCOPE=`ip route get 1 | awk '{print $5;exit}'`
ORIG_ST=`ip route get 1 | awk '{print $7;exit}'`

echo "Original send through address $ORIG_ST"
echo "Original send through scope $ORIG_ST_SCOPE"
echo "Original gateway $ORIG_GW"

if [ -f `which realpath` ]; then
  CONFIG_FULL_PATH=`realpath $CONFIG_FILE`
  echo "Using config file $CONFIG_FULL_PATH"
fi

config_route() {
  # Give some time for Mellow to open the TUN device.
  sleep 3
  echo 'Setting up routing table...'
  sudo ip route del default table main
  sudo ip route add default via $TUN_GW table main
  sudo ip route add default via $ORIG_GW dev $ORIG_ST_SCOPE table default
  sudo ip rule add from $ORIG_ST table default
}

recover_route() {
  echo 'Recovering routing table...'
  sudo ip rule del from $ORIG_ST table default
  sudo ip route del default table default
  sudo ip route del default table main
  sudo ip route add default via $ORIG_GW table main
}

# Configure the routing table in the background.
config_route &

# Run Mellow in blocking mode.
sudo ./core \
-tunAddr $TUN_ADDR \
-tunGw $TUN_GW \
-tunMask $TUN_MASK \
-sendThrough $ORIG_ST \
-vconfig $CONFIG_FILE \
-proxyType v2ray \
-relayICMP \
-loglevel info \
-stats

# Recover the routing table after Mellow exits.
recover_route
