const convert = require('@mellow/config/convert')

const conf = `
[Endpoint]
; tag, parser, parser-specific params...
Direct, builtin, freedom, domainStrategy=UseIP
Reject, builtin, blackhole
Dns-Out, builtin, dns
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/v2?network=ws&tls=true#WSS+Outbound
Proxy-2, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp#TCP+Outbound

[EndpointGroup]
; tag, colon-seperated list of selectors or endpoint tags, strategy, strategy-specific params...
MyGroup, Proxy-1:Proxy-2, latency, interval=300, timeout=6

[RoutingRule]
; type, filter, endpoint tag or enpoint group tag
DOMAIN-KEYWORD, geosite:category-ads-all, Reject
IP-CIDR, 8.8.8.8/32, MyGroup
GEOIP, cn, Direct
PORT, 123, Direct
DOMAIN-FULL, www.google.com, MyGroup
DOMAIN-KEYWORD, geosite:cn, Direct
DOMAIN-KEYWORD, bilibili, Direct
PROCESS-NAME, git, Proxy-2
FINAL, Direct

[RoutingDomainStrategy]
IPIfNonMatch

[Dns]
; hijack = dns endpoint tag
hijack=Dns-Out

[DnsServer]
; address, port, tag
223.5.5.5
8.8.8.8,53,Remote
8.8.4.4

[DnsRule]
; type, filter, dns server tag
DOMAIN-KEYWORD, geosite:geolocation-!cn, Remote

[DnsHost]
; domain = ip
localhost = 127.0.0.1

[DnsClientIp]
114.114.114.114

[Log]
loglevel = warning
`

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
      "protocol": "blackhole"
    },
    {
      "tag": "Dns-Out",
      "protocol": "dns",
      "settings": {}
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
          "path": "\/v2"
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
          "Proxy-2"
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
          "geoip:cn"
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
          "domain:www.google.com"
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
          "geosite:geolocation-!cn"
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
    const lines = convert.getLinesBySection(conf, 'RoutingRule')
    const expectedLines = [
      'DOMAIN-KEYWORD, geosite:category-ads-all, Reject',
      'IP-CIDR, 8.8.8.8/32, MyGroup',
      'GEOIP, cn, Direct',
      'PORT, 123, Direct',
      'DOMAIN-FULL, www.google.com, MyGroup',
      'DOMAIN-KEYWORD, geosite:cn, Direct',
      'DOMAIN-KEYWORD, bilibili, Direct',
      'PROCESS-NAME, git, Proxy-2',
      'FINAL, Direct'
    ]
    expect(lines).toEqual(expectedLines)
  })

  test('Construct routing object', () => {
    const routingDomainStrategy = convert.getLinesBySection(conf, 'RoutingDomainStrategy')
    const balancerRule = convert.getLinesBySection(conf, 'EndpointGroup')
    const routingRule = convert.getLinesBySection(conf, 'RoutingRule')
    const dnsConf = convert.getLinesBySection(conf, 'Dns')
    const routing = convert.constructRouting(routingDomainStrategy, balancerRule, routingRule, dnsConf)
    expect(routing).toEqual(JSON.parse(json).routing)
  })

  test('Construct dns object', () => {
    const dnsServer = convert.getLinesBySection(conf, 'DnsServer')
    const dnsRule = convert.getLinesBySection(conf, 'DnsRule')
    const dnsHost = convert.getLinesBySection(conf, 'DnsHost')
    const dnsClientIp = convert.getLinesBySection(conf, 'DnsClientIp')
    const dns = convert.constructDns(dnsServer, dnsRule, dnsHost, dnsClientIp)
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
    const v2json = convert.constructJson(conf)
    expect(v2json).toEqual(JSON.parse(json))
  })
})
