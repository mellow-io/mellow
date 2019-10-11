exports.confTemplate = `
[Endpoint]
; tag, parser, parser-specific params...
Direct, builtin, freedom, domainStrategy=UseIP
Reject, builtin, blackhole
Dns-Out, builtin, dns
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/v2?network=ws&tls=true
Proxy-2, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp
Proxy-3, ss, ss://aes-128-gcm:pass@192.168.100.1:8888

[EndpointGroup]
; tag, colon-seperated list of selectors or endpoint tags, strategy, strategy-specific params...
MyGroup, Proxy-1:Proxy-2:Proxy-3, latency, interval=300, timeout=6

[Routing]
domainStrategy = IPIfNonMatch

[RoutingRule]
; type, filter, endpoint tag or enpoint group tag
DOMAIN-KEYWORD, geosite:category-ads-all, Reject
IP-CIDR, 223.5.5.5/32, Direct
IP-CIDR, 8.8.8.8/32, MyGroup
IP-CIDR, 8.8.4.4/32, MyGroup
DOMAIN-KEYWORD, geosite:cn, Direct
GEOIP, cn, Direct
PORT, 123, Direct
PROCESS-NAME, cloudmusic.exe, Direct
PROCESS-NAME, NeteaseMusic, Direct
FINAL, MyGroup

[Dns]
; hijack = dns endpoint tag
hijack = Dns-Out
clientIp = 114.114.114.114

[DnsServer]
; address, port, tag
223.5.5.5
8.8.8.8, 53, Remote
8.8.4.4

[DnsRule]
; type, filter, dns server tag
DOMAIN-KEYWORD, geosite:geolocation-!cn, Remote

[DnsHost]
; domain = ip
localhost = 127.0.0.1

[Log]
loglevel = warning
`
exports.jsonTemplate = `{
    "log": {
        "loglevel": "warning"
    },
    "outbounds": [
        {
            "protocol": "vmess",
            "settings": {
                "vnext": [
                    {
                        "users": [
                            {
                                "id": "d2953280-9eb3-451d-aef6-283cd79ba62c",
                                "alterId": 4
                            }
                        ],
                        "address": "yourserver.com",
                        "port": 10086
                    }
                ]
            },
            "tag": "proxy"
        },
        {
            "protocol": "freedom",
            "settings": {
              "domainStrategy": "UseIP"
            },
            "tag": "direct"
        }
    ],
    "dns": {
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
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {
                "ip": [
                    "8.8.8.8/32"
                ],
                "type": "field",
                "outboundTag": "proxy"
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
                "ip": [
                    "0.0.0.0/0",
                    "::/0"
                ],
                "type": "field",
                "outboundTag": "proxy"
            }
        ]
    }
}`
