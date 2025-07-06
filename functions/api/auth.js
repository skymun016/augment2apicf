// Cloudflare Pages Function: /api/auth
const CLIENT_ID = "v";

export async function onRequestGet(context) {
    const { request, env } = context;
    
    try {
        // 检查 KV 绑定
        if (!env.TOKENS) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'KV 存储未正确配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证认证
        if (!(await validateAuth(request, env))) {
            return new Response(JSON.stringify({
                status: 'error',
                error: '未授权访问'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 生成 OAuth 状态
        const oauthState = await createOAuthState();
        
        // 保存 OAuth 状态到 KV，添加创建时间元数据
        const stateKey = `oauth_state:${oauthState.state}`;
        await env.TOKENS.put(stateKey, JSON.stringify(oauthState), {
            expirationTtl: 3600,
            metadata: { createdAt: Date.now() }
        }); // 1小时过期
        
        // 生成授权 URL
        const authorizeURL = generateAuthorizeURL(oauthState);
        
        return new Response(JSON.stringify({
            status: 'success',
            authorize_url: authorizeURL
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: '生成授权链接失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function createOAuthState() {
    const codeVerifier = generateRandomString(128);
    const codeChallengeHash = await sha256(codeVerifier);
    const codeChallenge = base64URLEncode(codeChallengeHash);
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

async function validateAuth(request, env) {
    if (!env.ACCESS_PWD) return true; // 如果没有设置密码，不需要验证

    const authToken = request.headers.get('X-Auth-Token') ||
                     getCookieValue(request.headers.get('Cookie'), 'auth_token');

    if (!authToken) return false;

    try {
        const sessionKey = `session_token:${authToken}`;
        const session = await env.TOKENS.get(sessionKey);
        return session === 'valid';
    } catch (error) {
        console.error('KV access error in validateAuth:', error);
        return false;
    }
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return new Uint8Array(hashBuffer);
}

function base64URLEncode(buffer) {
    // 将 Uint8Array 转换为字符串
    const bytes = Array.from(buffer);
    const binaryString = String.fromCharCode(...bytes);
    // 转换为 base64 并替换字符
    const base64 = btoa(binaryString);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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
