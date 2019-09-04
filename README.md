# Mellow
一个基于规则进行透明代理的 V2Ray 客户端，支持 Windows、macOS 和 Linux。

## 下载

https://github.com/eycorsican/Mellow/releases

## 特性
Mellow 可对所有应用、所有请求进行透明代理，不需要为每个应用或程序单独设置代理，它所支持的特性可以概括为：

|     | [Mellow](https://github.com/eycorsican/Mellow) | [Surge Mac](https://nssurge.com/) | [SSTap](https://www.sockscap64.com/sstap-enjoy-gaming-enjoy-sstap/) | [Proxifier](https://www.proxifier.com/) | [Outline](https://getoutline.org/) |
|:---:|:------:|:---------:|:-----:|:---------:|:-------:|
| Windows 支持 | ✅ | | ✅ | ✅ | ✅ |
| macOS 支持 | ✅ | ✅ | | ✅ | ✅ |
| Linux 支持 | ✅ | | | | ✅ |
| 透明代理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| TCP 代理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| UDP 代理 | ✅ | ✅ | ✅ | | ✅ |
| IP 规则 | ✅ | ✅ | ✅ | ✅ |
| 域名规则 | ✅ | ✅ | | ✅ |
| 应用进程规则 | ✅ | ✅ | | ✅ |
| 端口规则 | ✅ | ✅ | | ✅ |
| MitM | | ✅ | | |
| URL Rewrite | | ✅ | | |
| 多个代理出口 | ✅ | ✅ | | ✅ |
| 负载均衡 | ✅ | ✅ | | |
| DNS 分流 | ✅ | ✅ | | |
| SOCKS | ✅ | ✅ | ✅ | ✅ |
| Shadowsocks | ✅ | ✅ | ✅ | | ✅ |
| VMess | ✅ | | | |
| WebSocket, mKCP, QUIC, HTTP/2 传输| ✅ | | | |

其它 V2Ray 所支持的功能也都是支持的，上面并没有全部列出。

## 构建
```sh
# 下载依赖数据
yarn dlgeo

# macOS
yarn && yarn distmac

# Windows
yarn && yarn distwin

# Linux
yarn && yarn distlinux
```

## 扩展功能配置方式

### 自动选择最优线路
可根据代理请求的 RTT，自动选择负载均衡组中最优线路来转发请求。

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


## 应用进程规则
支持 `*` 和 `?` 通配符匹配，匹配内容为进程名称。

在 Windows 上，进程名称通常为 `xxx.exe`，例如 `chrome.exe`，在 Mellow 的 `Statistics` 中可方便查看。

在 macOS 上也可以通过 Mellow 的 `Statistics` 查看，也可以通过 `ps` 命令查看进程。

```json
"routing": {
    "rules": [
        {
            "app": [
                "git*",
                "chrome.exe"
            ],
            "type": "field",
            "outboundTag": "proxy"
        }
    ]
}
```

## 一些说明

### 要不要使用 Mellow？
Mellow 是一个透明代理客户端，如果不理解，那说得实际点，就是不仅可以代理浏览器的请求，还可以代理微信、QQ、Telegram 客户端、Instagram 客户端、网易云音乐、各种命令行工具、Docker 容器、虚拟机、WSL、各种 IDE、各种游戏等等的网络请求，不需要任何额外的代理设置。

所以也很清楚的是，如果仅需要代理浏览器的请求，或者也不嫌麻烦为个别程序单独设置代理的话，是没必要使用 Mellow 的。

### 关于配置和启动
配置就是 V2Ray 的纯文本 JSON 配置文件，没有任何 UI，初次打开程序，在菜单栏上选择 Config -> Edit 就会打开配置文件让你编辑，编辑好后保存，即可启动代理，待图标变色后，就表示代理已经启动。

macOS 客户端在初次和每次升级后启动时，都可能会弹框请求管理权限。

Windows 客户端在每次启动时都会弹框请求两次管理权限，如果不希望看到弹框，可以管理员身份运行，或者可改变 UAC（用户帐户控制设置） 的通知等级。

如果启动代理后有任何问题，比如弹出错误，比如无法连接，要反馈的话，请附上必要的截图（错误弹框等）和日志，日志更重要。

任何配置改动都需要重启生效。

### 关于 DNS
因为系统 DNS 很不好控制，推荐 Freedom Outbound 使用 UseIP 策略，再配置好内建 DNS 服务器，这样可以避免一些奇怪问题，也增加 DNS 缓存的利用效率。

DNS 的处理方面基本上和 [这篇文章](https://medium.com/@TachyonDevel/%E6%BC%AB%E8%B0%88%E5%90%84%E7%A7%8D%E9%BB%91%E7%A7%91%E6%8A%80%E5%BC%8F-dns-%E6%8A%80%E6%9C%AF%E5%9C%A8%E4%BB%A3%E7%90%86%E7%8E%AF%E5%A2%83%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8-62c50e58cbd0) 中介绍的没什么出入，默认使用 Sniffing 来处理 DNS 染污，可选择开启 Fake DNS 来进一步处理 Sniffing 处理不了的 DNS 染污，可以的话建议再自行配置 DNS Outbound 来做 DNS 分流（下面示例中有个大概配置），分流配置得当的话建议关闭 Fake DNS。

在什么情况下 Sniffing 不够用？当遇到非 TLS/HTTP 流量的情况，比如对于 QUIC 流量 Sniffing 就不起效；再比如 DNS 查询不返回 IP 的情况，应用程序就不会发出流量，也就没办法 Sniff。Google 的很多服务属于前者，Instagram 的一些请求属于后者。

### 关于 NAT 类型
使用 SOCKS 或 Shadowsocks 协议的话支持 Full Cone NAT，注意服务器也要是支持 Full Cone NAT 的，如果要代理游戏，服务端可以考虑用 shadowsocks-libev、go-shadowsocks2 等。

### 关于 Inbound
配置文件中不需要有 Inbound，但也可以自行配置 Inbound 作其它用途，例如可以像其它非透明代理客户端一样，配置文件中写上 SOCKS/HTTP Inbound，再手动配置到系统或浏览器的代理设置中，那样浏览器的请求就会从 SOCKS/HTTP Inbound 过来，而不经过 TUN 接口。

### 关于日志
日志有两份，一份是 Mellow 的日志，一份是 V2Ray 的日志，V2Ray 日志如果输出到 stdout/stderr，那 V2Ray 的日志会被打印到 Mellow 的日志里。

### 关于 GUI
目前没有任何计划做成 UI 配置的方式。

## 配置示例
<details><summary>cfg.json</summary>
<p>

```json
{
    "log": {
        "loglevel": "info"
    },
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
        },
        {
            "protocol": "dns",
            "tag": "dns_out"
        }
    ],
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
                "inboundTag": ["tun2socks"],
                "network": "udp",
                "port": 53,
                "outboundTag": "dns_out",
                "type": "field"
            },
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
