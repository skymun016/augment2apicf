// Cloudflare Pages Function: /api/logout
export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        // 获取认证令牌
        const authToken = request.headers.get('X-Auth-Token') || 
                         getCookieValue(request.headers.get('Cookie'), 'auth_token');
        
        if (authToken) {
            const sessionKey = `session_token:${authToken}`;
            await env.TOKENS.delete(sessionKey);
        }
        
        return new Response(JSON.stringify({
            status: 'success'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: '登出失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
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
