// Cloudflare Workers 版本的 Augment Token Manager
// 注意：这是一个简化版本，主要用于演示如何在 Cloudflare Workers 上部署

const CLIENT_ID = "v";

// HTML 模板
const LOGIN_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - Augment Token Manager</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .login-container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); width: 100%; max-width: 400px; }
        .login-header { text-align: center; margin-bottom: 2rem; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        .form-group input { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 5px; font-size: 1rem; box-sizing: border-box; }
        .login-btn { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; }
        .error-message { background: #fee; color: #c33; padding: 0.75rem; border-radius: 5px; margin-bottom: 1rem; text-align: center; display: none; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🔐 登录</h1>
            <p>Augment Token Manager</p>
        </div>
        <div id="error-message" class="error-message"></div>
        <form id="login-form">
            <div class="form-group">
                <label for="password">访问密码</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="login-btn">登录</button>
        </form>
    </div>
    <script>
        document.getElementById('login-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            if (data.status === 'success') {
                document.cookie = \`auth_token=\${data.token}; path=/; max-age=86400\`;
                window.location.href = '/';
            } else {
                document.getElementById('error-message').textContent = data.error;
                document.getElementById('error-message').style.display = 'block';
            }
        });
    </script>
</body>
</html>
`;

const INDEX_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Augment Token Manager</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; margin: 0; padding: 2rem; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 3rem; }
        .card { background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); padding: 2rem; margin-bottom: 2rem; }
        .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 5px; cursor: pointer; font-size: 1rem; text-decoration: none; display: inline-block; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        .form-group input { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 5px; font-size: 1rem; box-sizing: border-box; }
        .token-item { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 5px; padding: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
        .token-info { flex: 1; }
        .token { font-family: monospace; font-size: 0.9rem; color: #495057; word-break: break-all; }
        .message { padding: 1rem; border-radius: 5px; margin-bottom: 1rem; }
        .message.success { background: #d4edda; color: #155724; }
        .message.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Augment Token Manager</h1>
            <p>简单易用的 Augment Token 获取和管理工具</p>
        </div>
        <div id="message" class="message" style="display: none;"></div>
        <div class="card">
            <h2>🔑 获取新的 Token</h2>
            <button id="get-auth-btn" class="btn">📋 获取授权链接</button>
            <div id="auth-url-container" style="display: none; margin-top: 1rem;">
                <div class="form-group">
                    <label>授权链接（点击复制）：</label>
                    <input type="text" id="auth-url" readonly onclick="this.select(); document.execCommand('copy'); showMessage('授权链接已复制到剪贴板', 'success')">
                </div>
            </div>
            <form id="token-form" style="margin-top: 2rem;">
                <div class="form-group">
                    <label for="auth-code">授权码 *</label>
                    <input type="text" id="auth-code" name="code" required placeholder="从授权回调页面复制的授权码">
                </div>
                <div class="form-group">
                    <label for="tenant-url">租户URL *</label>
                    <input type="url" id="tenant-url" name="tenant_url" required placeholder="https://d0.api.augmentcode.com/" value="https://d0.api.augmentcode.com/">
                </div>
                <button type="submit" class="btn">🎯 获取 Token</button>
            </form>
        </div>
        <div class="card">
            <h2>📋 已保存的 Tokens</h2>
            <div id="token-list-container">
                <div>加载中...</div>
            </div>
        </div>
    </div>
    <script>
        let authToken = '';
        function getAuthToken() {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'auth_token') return value;
            }
            return '';
        }
        function showMessage(text, type = 'success') {
            const messageEl = document.getElementById('message');
            messageEl.textContent = text;
            messageEl.className = \`message \${type}\`;
            messageEl.style.display = 'block';
            setTimeout(() => messageEl.style.display = 'none', 5000);
        }
        document.getElementById('get-auth-btn').addEventListener('click', async function() {
            try {
                const response = await fetch('/api/auth', { headers: { 'X-Auth-Token': authToken } });
                const data = await response.json();
                if (data.status === 'success') {
                    document.getElementById('auth-url').value = data.authorize_url;
                    document.getElementById('auth-url-container').style.display = 'block';
                    showMessage('授权链接已生成', 'success');
                }
            } catch (error) {
                showMessage('获取授权链接失败', 'error');
            }
        });
        document.getElementById('token-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const response = await fetch('/api/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                    body: JSON.stringify({ code: formData.get('code'), tenant_url: formData.get('tenant_url') })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    showMessage('Token 获取成功！', 'success');
                    document.getElementById('token-form').reset();
                    document.getElementById('tenant-url').value = 'https://d0.api.augmentcode.com/';
                    loadTokens();
                } else {
                    showMessage('获取Token失败: ' + data.error, 'error');
                }
            } catch (error) {
                showMessage('网络错误', 'error');
            }
        });
        async function loadTokens() {
            try {
                const response = await fetch('/api/tokens', { headers: { 'X-Auth-Token': authToken } });
                const data = await response.json();
                const container = document.getElementById('token-list-container');
                if (data.status === 'success' && data.tokens.length > 0) {
                    container.innerHTML = data.tokens.map(token => \`
                        <div class="token-item">
                            <div class="token-info">
                                <div class="token">\${token.token}</div>
                                <div style="font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem;">\${token.tenant_url}</div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6c757d;">还没有保存的 Token</div>';
                }
            } catch (error) {
                document.getElementById('token-list-container').innerHTML = '<div style="color: #721c24;">加载失败</div>';
            }
        }
        document.addEventListener('DOMContentLoaded', function() {
            authToken = getAuthToken();
            loadTokens();
        });
    </script>
</body>
</html>
`;

// 工具函数
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64URLEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// OAuth 状态管理
let globalOAuthState = null;

async function createOAuthState() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = base64URLEncode(await sha256(codeVerifier));
    const state = generateRandomString(32);
    
    return {
        codeVerifier,
        codeChallenge,
        state,
        creationTime: Date.now()
    };
}

function generateAuthorizeURL(oauthState) {
    const params = new URLSearchParams({
        response_type: 'code',
        code_challenge: oauthState.codeChallenge,
        client_id: CLIENT_ID,
        state: oauthState.state,
        prompt: 'login'
    });
    
    return `https://auth.augmentcode.com/authorize?${params.toString()}`;
}

// 主要的请求处理函数
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // 初始化 OAuth 状态
        if (!globalOAuthState) {
            globalOAuthState = await createOAuthState();
        }
        
        // 路由处理
        if (path === '/login') {
            return new Response(LOGIN_HTML, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (path === '/') {
            // 简单的认证检查
            if (env.ACCESS_PWD) {
                const authToken = request.headers.get('X-Auth-Token') || 
                                getCookieValue(request.headers.get('Cookie'), 'auth_token');
                
                if (!authToken || !await validateToken(authToken, env)) {
                    return Response.redirect(url.origin + '/login', 302);
                }
            }
            
            return new Response(INDEX_HTML, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        // API 路由
        if (path.startsWith('/api/')) {
            return handleAPI(request, env, path);
        }
        
        return new Response('Not Found', { status: 404 });
    }
};

// API 处理函数
async function handleAPI(request, env, path) {
    const url = new URL(request.url);
    
    if (path === '/api/login' && request.method === 'POST') {
        const { password } = await request.json();
        
        if (password === env.ACCESS_PWD) {
            const token = generateRandomString(32);
            // 在实际应用中，这里应该将 token 存储到 KV 或数据库
            // 这里简化处理，直接返回 token
            
            return new Response(JSON.stringify({
                status: 'success',
                token: token
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                status: 'error',
                error: '密码错误'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    if (path === '/api/auth' && request.method === 'GET') {
        const authorizeURL = generateAuthorizeURL(globalOAuthState);
        
        return new Response(JSON.stringify({
            status: 'success',
            authorize_url: authorizeURL
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (path === '/api/callback' && request.method === 'POST') {
        const { code, tenant_url } = await request.json();
        
        try {
            // 获取访问令牌
            const tokenResponse = await fetch(tenant_url + 'token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    client_id: CLIENT_ID,
                    code_verifier: globalOAuthState.codeVerifier,
                    redirect_uri: '',
                    code: code
                })
            });
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.access_token) {
                // 保存到 KV 存储
                const tokenKey = `token:${tokenData.access_token}`;
                await env.TOKENS.put(tokenKey, JSON.stringify({
                    token: tokenData.access_token,
                    tenant_url: tenant_url,
                    remark: '',
                    created_at: Date.now()
                }));
                
                return new Response(JSON.stringify({
                    status: 'success',
                    token: tokenData.access_token
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error('获取访问令牌失败');
            }
        } catch (error) {
            return new Response(JSON.stringify({
                status: 'error',
                error: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    if (path === '/api/tokens' && request.method === 'GET') {
        try {
            // 从 KV 存储获取所有 tokens
            const { keys } = await env.TOKENS.list({ prefix: 'token:' });
            const tokens = [];
            
            for (const key of keys) {
                const tokenData = await env.TOKENS.get(key.name);
                if (tokenData) {
                    tokens.push(JSON.parse(tokenData));
                }
            }
            
            return new Response(JSON.stringify({
                status: 'success',
                tokens: tokens,
                total: tokens.length
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                status: 'error',
                error: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    return new Response('API Not Found', { status: 404 });
}

// 辅助函数
function getCookieValue(cookieString, name) {
    if (!cookieString) return null;
    
    const cookies = cookieString.split(';');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
            return cookieValue;
        }
    }
    return null;
}

async function validateToken(token, env) {
    // 简化的 token 验证
    // 在实际应用中，应该检查 KV 存储中的 session token
    return token && token.length > 10;
}
