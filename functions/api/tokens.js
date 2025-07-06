// Cloudflare Pages Function: /api/tokens
export async function onRequestGet(context) {
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
        
        // 获取所有 token
        const { keys } = await env.TOKENS.list({ prefix: 'token:' });
        const tokens = [];
        
        for (const key of keys) {
            const tokenDataStr = await env.TOKENS.get(key.name);
            if (tokenDataStr) {
                const tokenData = JSON.parse(tokenDataStr);
                tokens.push({
                    token: tokenData.token,
                    tenant_url: tokenData.tenant_url,
                    remark: tokenData.remark || '',
                    created_at: tokenData.created_at
                });
            }
        }
        
        // 按创建时间排序（最新的在前）
        tokens.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
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
            error: '获取 Token 列表失败: ' + error.message
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
