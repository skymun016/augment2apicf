export async function onRequest(context) {
    const { request, env } = context;
    
    // 只允许 GET 请求
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({
            status: 'error',
            error: 'Method not allowed'
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // 从环境变量获取访问密码，如果没有设置则使用默认值
        const accessPassword = env.ACCESS_PASSWORD || 'augment2024';
        
        // 为了安全，我们不直接返回密码，而是返回密码的哈希值
        // 前端可以用这个哈希值来验证用户输入的密码
        const passwordHash = await hashPassword(accessPassword);
        
        return new Response(JSON.stringify({
            status: 'success',
            passwordHash: passwordHash,
            hasCustomPassword: !!env.ACCESS_PASSWORD
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        console.error('获取配置失败:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: '获取配置失败'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 简单的密码哈希函数
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
