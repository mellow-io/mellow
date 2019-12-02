exports.confTemplate = `[Endpoint]
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/path?network=ws&tls=true&ws.host=example.com
Direct, builtin, freedom, domainStrategy=UseIP
Dns-Out, builtin, dns

[RoutingRule]
DOMAIN-KEYWORD, geosite:cn, Direct
GEOIP, cn, Direct
GEOIP, private, Direct
FINAL, Proxy-1

[Dns]
hijack = Dns-Out

[DnsServer]
localhost
8.8.8.8`

exports.jsonTemplate = `{
  "dns": {
    "servers": [
      "localhost",
      "8.8.8.8"
    ]
  },
  "outbounds": [
    {
      "protocol": "vmess",
      "tag": "Proxy-1",
      "settings": {
        "vnext": [
          {
            "users": [
              {
                "id": "75da2e14-4d08-480b-b3cb-0079a0c51275"
              }
            ],
            "address": "example.com",
            "port": 443
          }
        ]
      },
      "streamSettings": {
        "network": "ws",
        "security": "tls",
        "wsSettings": {
          "headers": {
            "Host": "example.com"
          },
          "path": "/path"
        }
      }
    },
    {
      "protocol": "freedom",
      "tag": "Direct",
      "settings": {
        "domainStrategy": "UseIP"
      }
    },
    {
      "protocol": "dns",
      "tag": "Dns-Out",
      "settings": {}
    }
  ],
  "routing": {
    "rules": [
      {
        "type": "field",
        "outboundTag": "Dns-Out",
        "inboundTag": [
          "tun2socks"
        ],
        "network": "udp",
        "port": 53
      },
      {
        "type": "field",
        "outboundTag": "Direct",
        "domain": [
          "geosite:cn"
        ]
      },
      {
        "type": "field",
        "outboundTag": "Direct",
        "ip": [
          "geoip:cn",
          "geoip:private"
        ]
      },
      {
        "type": "field",
        "outboundTag": "Proxy-1",
        "network": "tcp,udp"
      }
    ]
  }
}`
