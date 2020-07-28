const convert = require('@mellow/config/convert')

const conf = `
[Endpoint]
; tag, parser, parser-specific params...

Direct, builtin, freedom, domainStrategy=UseIP

Reject, builtin, blackhole, type=http

Dns-Out, builtin, dns, network=tcp, address=1.1.1.1, port=53

; http
Http-Out, builtin, http, address=192.168.100.1, port=1087, user=myuser, pass=mypass

; socks5
Socks-Out, builtin, socks, address=127.0.0.1, port=1080, user=myuser, pass=mypass

; ws + tls
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/v2?network=ws&tls=true&ws.host=example.com

; tcp, mux enabled, concurrency 8
Proxy-2, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp&mux=8

; shadowsocks SIP002
Proxy-3, ss, ss://YWVzLTEyOC1nY206dGVzdA==@192.168.100.1:8888

; shadowsocks SIP002-without-base64-encode
Proxy-4, ss, ss://aes-128-gcm:pass@192.168.100.1:8888

; h2, multiple hosts
Proxy-5, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/h2?network=http&http.host=example.com%2Cexample1.com&tls=true&tls.allowinsecure=true

; tcp + tls
Proxy-6, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp&tls=true&tls.servername=example.com&tls.allowinsecure=true&sockopt.tcpfastopen=true

; kcp
Proxy-7, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=kcp&kcp.mtu=1350&kcp.tti=20&kcp.uplinkcapacity=1&kcp.downlinkcapacity=2&kcp.congestion=false&header=none&sockopt.tos=184

; quic
Proxy-8, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=quic&quic.security=none&quic.key=&header=none&tls=false&sockopt.tos=184

[EndpointGroup]
; tag, colon-seperated list of selectors or endpoint tags, strategy, strategy-specific params...
MyGroup, Proxy-1:Proxy-2:Proxy-3, latency, interval=300, timeout=6

[Routing]
domainStrategy = IPIfNonMatch

[RoutingRule]
; type, filter, endpoint tag or enpoint group tag
DOMAIN-KEYWORD, geosite:category-ads-all, Reject
IP-CIDR, 8.8.8.8/32, MyGroup
GEOIP, cn, Direct
GEOIP, private, Direct
PORT, 123, Direct
DOMAIN-FULL, a.google.com, MyGroup
DOMAIN, b.google.com, MyGroup
DOMAIN-SUFFIX, c.google.com, MyGroup
DOMAIN-KEYWORD, geosite:cn, Direct
DOMAIN-KEYWORD, bilibili, Direct
PROCESS-NAME, git, Proxy-2
INCLUDE, subconf1.list
INCLUDE, subconf2.list, MyGroup
INCLUDE, subconf3.list, MyGroup
NETWORK, udp:tcp, Direct
FINAL, Direct

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
DOMAIN, www.google.com, Remote
DOMAIN-FULL, www.twitter.com, Remote
DOMAIN-SUFFIX, google.com, Remote

[DnsHost]
; domain = ip
localhost = 127.0.0.1

[Log]
loglevel = warning
`

const subconf1 = `
[RoutingRule]
PROCESS-NAME, storedownloadd, Direct
PROCESS-NAME, com.apple.WeatherKitService, Direct
`

const subconf2 = `
[RoutingRule]
PROCESS-NAME, trustd
DOMAIN-SUFFIX, apple.com
`

const subconf3 = `
[RoutingRule]
DOMAIN-SUFFIX, icloud.com, Direct
DOMAIN-SUFFIX, me.com, Direct
`

const subConf = {
  'RoutingRule': {
      'subconf1.list': subconf1,
      'subconf2.list': subconf2,
      'subconf3.list': subconf3,
    }
  }

const json = `
{
  "log": {
    "loglevel": "warning"
  },
  "outbounds": [
    {
      "tag": "Direct",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIP"
      }
    },
    {
      "tag": "Reject",
      "protocol": "blackhole",
      "settings": {
        "response": {
          "type": "http"
        }
      }
    },
    {
      "tag": "Dns-Out",
      "protocol": "dns",
      "settings": {
        "network": "tcp",
        "address": "1.1.1.1",
        "port": 53
      }
    },
    {
      "tag": "Http-Out",
      "protocol": "http",
      "settings": {
        "servers": [
          {
            "address": "192.168.100.1",
            "port": 1087,
            "users": [
              {
                "user": "myuser",
                "pass": "mypass"
              }
            ]
          }
        ]
      }
    },
    {
      "tag": "Socks-Out",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "127.0.0.1",
            "port": 1080,
            "users": [
              {
                "user": "myuser",
                "pass": "mypass"
              }
            ]
          }
        ]
      }
    },
    {
      "tag": "Proxy-1",
      "protocol": "vmess",
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
          "path": "\/v2",
          "headers": {
            "Host": "example.com"
          }
        }
      }
    },
    {
      "tag": "Proxy-2",
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "users": [
              {
                "id": "75da2e14-4d08-480b-b3cb-0079a0c51275"
              }
            ],
            "address": "example.com",
            "port": 10025
          }
        ]
      },
      "streamSettings": {
        "network": "tcp"
      },
      "mux": {
        "enabled": true,
        "concurrency": 8
      }
    },
    {
      "tag": "Proxy-3",
      "protocol": "shadowsocks",
      "settings": {
        "servers": [
          {
            "method": "aes-128-gcm",
            "password": "test",
            "address": "192.168.100.1",
            "port": 8888
          }
        ]
      }
    },
    {
      "tag": "Proxy-4",
      "protocol": "shadowsocks",
      "settings": {
        "servers": [
          {
            "method": "aes-128-gcm",
            "password": "pass",
            "address": "192.168.100.1",
            "port": 8888
          }
        ]
      }
    },
    {
      "tag": "Proxy-5",
      "protocol": "vmess",
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
        "network": "http",
        "security": "tls",
        "tlsSettings": {
          "allowInsecure": true
        },
        "httpSettings": {
          "path": "/h2",
          "host": [
            "example.com",
            "example1.com"
          ]
        }
      }
    },
    {
      "tag": "Proxy-6",
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "users": [
              {
                "id": "75da2e14-4d08-480b-b3cb-0079a0c51275"
              }
            ],
            "address": "example.com",
            "port": 10025
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "tls",
        "tlsSettings": {
          "serverName": "example.com",
          "allowInsecure": true
        },
        "sockopt": {
          "tcpFastOpen": true
        }
      }
    },
    {
      "tag": "Proxy-7",
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "users": [
              {
                "id": "75da2e14-4d08-480b-b3cb-0079a0c51275"
              }
            ],
            "address": "example.com",
            "port": 10025
          }
        ]
      },
      "streamSettings": {
        "network": "kcp",
        "kcpSettings": {
          "mtu": 1350,
          "tti": 20,
          "uplinkCapacity": 1,
          "downlinkCapacity": 2,
          "congestion": false,
          "header": {
            "type": "none"
          }
        },
        "sockopt": {
          "tos": 184
        }
      }
    },
    {
      "tag": "Proxy-8",
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "users": [
              {
                "id": "75da2e14-4d08-480b-b3cb-0079a0c51275"
              }
            ],
            "address": "example.com",
            "port": 10025
          }
        ]
      },
      "streamSettings": {
        "network": "quic",
        "security": "none",
        "quicSettings": {
          "security": "none",
          "key": "",
          "header": {
            "type": "none"
          }
        },
        "sockopt": {
          "tos": 184
        }
      }
    }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "balancers": [
      {
        "tag": "MyGroup",
        "selector": [
          "Proxy-1",
          "Proxy-2",
          "Proxy-3"
        ],
        "strategy": "latency",
        "interval": 300,
        "timeout": 6
      }
    ],
    "rules": [
      {
        "inboundTag": ["tun2socks"],
        "network": "udp",
        "port": 53,
        "outboundTag": "Dns-Out",
        "type": "field"
      },
      {
        "type": "field",
        "domain": [
          "geosite:category-ads-all"
        ],
        "outboundTag": "Reject"
      },
      {
        "type": "field",
        "ip": [
          "8.8.8.8\/32"
        ],
        "balancerTag": "MyGroup"
      },
      {
        "type": "field",
        "ip": [
          "geoip:cn",
          "geoip:private"
        ],
        "outboundTag": "Direct"
      },
      {
        "type": "field",
        "port": "123",
        "outboundTag": "Direct"
      },
      {
        "type": "field",
        "domain": [
          "full:a.google.com",
          "full:b.google.com",
          "domain:c.google.com"
        ],
        "balancerTag": "MyGroup"
      },
      {
        "type": "field",
        "domain": [
          "geosite:cn",
          "bilibili"
        ],
        "outboundTag": "Direct"
      },
      {
        "type": "field",
        "app": [
          "git"
        ],
        "outboundTag": "Proxy-2"
      },
      {
        "type": "field",
        "app": [
          "storedownloadd",
          "com.apple.WeatherKitService"
        ],
        "outboundTag": "Direct"
      },
      {
        "type": "field",
        "app": [
          "trustd"
        ],
        "balancerTag": "MyGroup"
      },
      {
        "type": "field",
        "domain": [
          "domain:apple.com"
        ],
        "balancerTag": "MyGroup"
      },
      {
        "type": "field",
        "domain": [
          "domain:icloud.com",
          "domain:me.com"
        ],
        "balancerTag": "MyGroup"
      },
      {
        "type": "field",
        "network": "udp,tcp",
        "outboundTag": "Direct"
      },
      {
        "type": "field",
        "ip": [
          "0.0.0.0\/0",
          "::\/0"
        ],
        "outboundTag": "Direct"
      }
    ]
  },
  "dns": {
    "servers": [
      "223.5.5.5",
      {
        "address": "8.8.8.8",
        "port": 53,
        "domains": [
          "geosite:geolocation-!cn",
          "full:www.google.com",
          "full:www.twitter.com",
          "domain:google.com"
        ]
      },
      "8.8.4.4"
    ],
    "hosts": {
      "localhost": "127.0.0.1"
    },
    "clientIp": "114.114.114.114"
  }
}
`

describe('Convert conf config to JSON', () => {
  test('Get lines by section', () => {
    const lines = convert.getLinesBySection(conf, 'DnsServer')
    const expectedLines = [
      '223.5.5.5',
      '8.8.8.8, 53, Remote',
      '8.8.4.4'
    ]
    expect(lines).toEqual(expectedLines)
  })

  test('Construct routing object', () => {
    const routingDomainStrategy = convert.getLinesBySection(conf, 'RoutingDomainStrategy')
    const routingConf = convert.getLinesBySection(conf, 'Routing')
    const balancerRule = convert.getLinesBySection(conf, 'EndpointGroup')
    const routingRule = convert.getLinesBySection(conf, 'RoutingRule')
    const dnsConf = convert.getLinesBySection(conf, 'Dns')
    const routing = convert.constructRouting(routingConf, routingDomainStrategy, balancerRule, routingRule, dnsConf, subConf)
    expect(routing).toEqual(JSON.parse(json).routing)
  })

  test('Construct dns object', () => {
    const dnsConf = convert.getLinesBySection(conf, 'Dns')
    const dnsServer = convert.getLinesBySection(conf, 'DnsServer')
    const dnsRule = convert.getLinesBySection(conf, 'DnsRule')
    const dnsHost = convert.getLinesBySection(conf, 'DnsHost')
    const dnsClientIp = convert.getLinesBySection(conf, 'DnsClientIp')
    const dns = convert.constructDns(dnsConf, dnsServer, dnsRule, dnsHost, dnsClientIp)
    expect(dns).toEqual(JSON.parse(json).dns)
  })

  test('Construct log object', () => {
    const logLines = convert.getLinesBySection(conf, 'Log')
    const log = convert.constructLog(logLines)
    expect(log).toEqual(JSON.parse(json).log)
  })

  test('Construct outbounds object', () => {
    const endpoint = convert.getLinesBySection(conf, 'Endpoint')
    const outbounds = convert.constructOutbounds(endpoint)
    expect(outbounds).toEqual(JSON.parse(json).outbounds)
  })

  test('Construct the whole JSON object', () => {
    const v2json = convert.constructJson(conf, subConf)
    expect(v2json).toEqual(JSON.parse(json))
  })
})
