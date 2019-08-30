# Mellow
A V2Ray client that can handle all TCP/UDP/ICMP traffic with domain/IP/app rules.

## Build
```sh
# download Geo data
yarn dlgeo

# macOS
yarn && yarn distmac

# Windows
yarn && yarn distwin
```

## Uninstall

### macOS
```sh
sudo rm -rf /Applications/Mellow.app
sudo rm -rf /Library/Application\ Support/Mellow
rm -rf ~/Library/Application\ Support/Mellow
```

### Windows
Uninstall from the Control Panel.

## TODO
- [x] macOS Support
- [x] Windows Support
- [ ] Linux Support

## Additional Features

### Latency Balancing
Select the best server automatically, measured by proxy request RTT.

```json
"routing": {
    "balancers": [
        {
            "tag": "server_lb",
            "selector": [
                "server_1",
                "server_2"
            ],
            "strategy": "latency",
            "totalMeasures": 2,
            "interval": 300,
            "delay": 1,
            "timeout": 6,
            "tolerance": 300,
            "probeTarget": "tls:www.google.com:443",
            "probeContent": "HEAD / HTTP/1.1\r\n\r\n"
        }
    ]
}
```

### Application Matcher
Support wildcard characters `*` and `?`.

```json
"routing": {
    "rules": [
        {
            "app": [
                "git",
                "brew",
                "Dropbox"
            ],
            "type": "field",
            "outboundTag": "proxy"
        }
    ]
}
```

## A Sample Config
<details><summary>cfg.json</summary>
<p>

```json
{
    "log": {
        "loglevel": "info"
    },
    "dns": {
        "hosts": {
            "localhost": "127.0.0.1"
        },
        "servers": [
            {
                "address": "8.8.8.8",
                "port": 53
            },
            {
                "address": "223.5.5.5",
                "port": 53,
                "domains": [
                    "geosite:cn"
                ]
            }
        ]
    },
    "outbounds": [
        {
            "protocol": "vmess",
            "settings": {},
            "tag": "economic_vps_1"
        },
        {
            "protocol": "vmess",
            "settings": {},
            "tag": "economic_vps_2"
        },
        {
            "protocol": "vmess",
            "settings": {},
            "tag": "bittorrent_vps_1"
        },
        {
            "protocol": "vmess",
            "settings": {},
            "tag": "expensive_vps_1"
        },
        {
            "protocol": "freedom",
            "settings": {},
            "tag": "direct"
        },
        {
            "settings": {},
            "protocol": "blackhole",
            "tag": "block"
        }
    ],
    "policy": {
        "levels": {
            "0": {
                "connIdle": 300,
                "downlinkOnly": 0,
                "uplinkOnly": 0,
                "handshake": 4
            }
        }
    },
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "balancers": [
            {
                "tag": "limited",
                "selector": [
                    "expensive_vps_1",
                    "economic_vps_1"
                ],
                "strategy": "latency",
                "totalMeasures": 2,
                "interval": 300,
                "delay": 1,
                "timeout": 6,
                "tolerance": 300,
                "probeTarget": "tls:www.google.com:443",
                "probeContent": "HEAD / HTTP/1.1\r\n\r\n"
            },
            {
                "tag": "bt",
                "selector": [
                    "bittorrent_vps_1"
                ]
            },
            {
                "tag": "nolimit",
                "selector": [
                    "economic_vps_1",
                    "economic_vps_2"
                ],
                "strategy": "latency",
                "totalMeasures": 2,
                "interval": 120
            }
        ],
        "rules": [
            {
                "domain": [
                    "domain:doubleclick.net"
                ],
                "type": "field",
                "outboundTag": "block"
            },
            {
                "type": "field",
                "ip": [
                    "1.1.1.1",
                    "9.9.9.9",
                    "8.8.8.8",
                    "8.8.4.4"
                ],
                "balancerTag": "limited"
            },
            {
                "app": [
                    "ssh",
                    "git",
                    "brew",
                    "Dropbox"
                ],
                "type": "field",
                "balancerTag": "limited"
            },
            {
                "type": "field",
                "domain": [
                    "geosite:cn"
                ],
                "outboundTag": "direct"
            },
            {
                "type": "field",
                "ip": [
                    "geoip:cn",
                    "geoip:private"
                ],
                "outboundTag": "direct"
            },
            {
                "type": "field",
                "app": [
                    "aria2c"
                ],
                "balancerTag": "bt"
            },
            {
                "type": "field",
                "domain": [
                    "googlevideo",
                    "dl.google.com",
                    "ytimg"
                ],
                "balancerTag": "nolimit"
            },
            {
                "type": "field",
                "domain": [
                    "domain:youtube.com",
                    "android",
                    "google",
                    "nyaa",
                    "git"
                ],
                "balancerTag": "limited"
            },
            {
                "ip": [
                    "0.0.0.0/0",
                    "::/0"
                ],
                "type": "field",
                "balancerTag": "nolimit"
            }
        ]
    }
}
```

</p>
</details>
