// Cloudflare Pages Function: /api/callback
const CLIENT_ID = "v";

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
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
        
        const { code, tenant_url } = await request.json();
        
        if (!code || !tenant_url) {
            return new Response(JSON.stringify({
                status: 'error',
                error: '缺少必要参数'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取最新的 OAuth 状态（简化处理，实际应该根据 state 参数获取）
        const { keys } = await env.TOKENS.list({ prefix: 'oauth_state:' });
        if (keys.length === 0) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'OAuth 状态已过期，请重新获取授权链接'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取最新的 OAuth 状态
        const latestStateKey = keys[keys.length - 1].name;
        const oauthStateStr = await env.TOKENS.get(latestStateKey);
        const oauthState = JSON.parse(oauthStateStr);
        
        // 获取访问令牌
        const tokenResponse = await fetch(tenant_url + 'token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                code_verifier: oauthState.codeVerifier,
                redirect_uri: '',
                code: code
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (tokenData.access_token) {
            // 保存 Token 到 KV 存储
            const tokenKey = `token:${tokenData.access_token}`;
            await env.TOKENS.put(tokenKey, JSON.stringify({
                token: tokenData.access_token,
                tenant_url: tenant_url,
                remark: '',
                created_at: Date.now()
            }));
            
            // 清理 OAuth 状态
            await env.TOKENS.delete(latestStateKey);
            
            return new Response(JSON.stringify({
                status: 'success',
                token: tokenData.access_token
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                status: 'error',
                error: '获取访问令牌失败: ' + (tokenData.error || '未知错误')
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: '处理回调失败: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function validateAuth(request, env) {
    if (!env.ACCESS_PWD) return true;
    
    const authToken = request.headers.get('X-Auth-Token') || 
                     getCookieValue(request.headers.get('Cookie'), 'auth_token');
    
    if (!authToken) return false;
    
    const sessionKey = `session_token:${authToken}`;
    const session = await env.TOKENS.get(sessionKey);
    
    return session === 'valid';
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
