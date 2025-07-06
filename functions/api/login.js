// Cloudflare Pages Function: /api/login
export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const { password } = await request.json();
        
        if (password === env.ACCESS_PWD) {
            // 生成会话令牌
            const token = generateRandomString(32);
            
            // 保存到 KV 存储
            const sessionKey = `session_token:${token}`;
            await env.TOKENS.put(sessionKey, 'valid', { expirationTtl: 86400 }); // 24小时过期
            
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
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: '请求处理失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
