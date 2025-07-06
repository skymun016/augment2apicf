# Augment Token Manager

> 🚀 简单易用的 Augment Token 获取和管理工具

一个极简的 Web 服务，专注于 Augment API Token 的获取和管理，去除了复杂的 API 代理功能，只保留核心的 OAuth 授权流程和 Token 存储功能。

## ✨ 功能特点

- 🔑 **简单的 OAuth 流程**: 一键获取 Augment 授权链接
- 📋 **Token 管理**: 保存、查看、删除 Token
- 🎯 **极简界面**: 清爽的 Web 界面，操作简单
- 🗄️ **Redis 存储**: 安全可靠的 Token 存储
- 🔒 **访问控制**: 可选的密码保护
- ☁️ **多平台部署**: 支持 Docker 和 Cloudflare Workers

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd augment-token-manager
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的配置
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问服务**
打开浏览器访问 `http://localhost:8080`

### 方式二：直接运行

1. **安装依赖**
```bash
go mod download
```

2. **设置环境变量**
```bash
export REDIS_CONN_STRING="redis://default:password@localhost:6379"
export ACCESS_PWD="your-password"
export PORT="8080"
```

3. **运行服务**
```bash
go run main.go
```

### 方式三：Cloudflare Workers

1. **安装 Wrangler CLI**
```bash
npm install -g wrangler
```

2. **配置 wrangler.toml**
编辑 `wrangler.toml` 文件，设置您的域名和 KV 命名空间

3. **创建 KV 命名空间**
```bash
wrangler kv:namespace create "TOKENS"
```

4. **设置环境变量**
在 Cloudflare Dashboard 中设置以下变量：
- `ACCESS_PWD`: 访问密码

5. **部署**
```bash
wrangler publish
```

## 🔧 环境变量配置

| 变量名 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| `REDIS_CONN_STRING` | Redis 连接字符串 | ✅ | - |
| `ACCESS_PWD` | 访问密码 | ✅ | - |
| `PORT` | 服务端口 | ❌ | 8080 |

### Redis 连接字符串格式
```
redis://default:password@host:port
```

## 📖 使用说明

### 1. 获取 Token

1. 访问主页面
2. 点击"获取授权链接"按钮
3. 复制生成的授权链接并在新窗口中打开
4. 完成 Augment 账号登录/注册
5. 从回调页面复制授权码
6. 在表单中输入授权码和租户 URL
7. 点击"获取 Token"按钮

### 2. 管理 Token

- **查看**: 在主页面可以看到所有已保存的 Token
- **备注**: 点击"备注"按钮为 Token 添加说明
- **删除**: 点击"删除"按钮移除不需要的 Token

### 3. 租户 URL 说明

常用的租户 URL 格式：
- `https://d0.api.augmentcode.com/`
- `https://d1.api.augmentcode.com/`
- `https://i0.api.augmentcode.com/`

## 🏗️ 项目结构

```
augment-token-manager/
├── main.go                 # 主程序入口
├── config/                 # 配置管理
│   ├── config.go          # 基础配置
│   └── redis.go           # Redis 操作
├── api/                    # API 处理
│   ├── auth.go            # 认证相关
│   └── token.go           # Token 管理
├── templates/              # HTML 模板
│   ├── login.html         # 登录页面
│   └── index.html         # 主页面
├── static/                 # 静态资源
│   └── augment.svg        # 图标
├── Dockerfile             # Docker 构建文件
├── docker-compose.yml     # Docker Compose 配置
├── wrangler.toml          # Cloudflare Workers 配置
├── worker.js              # Cloudflare Workers 代码
└── README.md              # 项目说明
```

## 🔒 安全说明

- 建议设置强密码作为访问密码
- Token 存储在 Redis 中，请确保 Redis 的安全性
- 生产环境建议使用 HTTPS
- 定期清理不需要的 Token

## 🆚 与原项目的区别

| 功能 | 原项目 | 简化版 |
|------|--------|--------|
| OpenAI API 代理 | ✅ | ❌ |
| Token 获取 | ✅ | ✅ |
| Token 管理 | ✅ | ✅ |
| 批量检测 | ✅ | ❌ |
| 并发控制 | ✅ | ❌ |
| 使用统计 | ✅ | ❌ |
| 复杂管理界面 | ✅ | ❌ |
| 极简界面 | ❌ | ✅ |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

<div align="center">
  <strong>如果这个项目对您有帮助，请给我们一个 ⭐ Star！</strong>
</div>
