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
        
        const { code, tenant_url, state, remark } = await request.json();

        if (!code || !tenant_url) {
            return new Response(JSON.stringify({
                status: 'error',
                error: '缺少必要参数 (code 或 tenant_url)'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证 tenant_url 格式
        if (!tenant_url.startsWith('https://') || !tenant_url.endsWith('/')) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'tenant_url 格式不正确，必须以 https:// 开头并以 / 结尾'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取对应的 OAuth 状态
        let oauthState = null;
        if (state) {
            const stateKey = `oauth_state:${state}`;
            const oauthStateStr = await env.TOKENS.get(stateKey);
            if (oauthStateStr) {
                try {
                    oauthState = JSON.parse(oauthStateStr);
                } catch (e) {
                    console.error('解析 OAuth 状态失败:', e);
                }
            }
        }

        // 如果没有找到对应的状态，尝试获取最新的状态
        if (!oauthState) {
            const { keys } = await env.TOKENS.list({ prefix: 'oauth_state:' });
            if (keys.length > 0) {
                // 按时间排序，获取最新的状态
                keys.sort((a, b) => b.metadata?.createdAt - a.metadata?.createdAt);
                const latestStateKey = keys[0].name;
                const oauthStateStr = await env.TOKENS.get(latestStateKey);
                if (oauthStateStr) {
                    try {
                        oauthState = JSON.parse(oauthStateStr);
                    } catch (e) {
                        console.error('解析最新 OAuth 状态失败:', e);
                    }
                }
            }
        }

        // 如果还是没有状态，返回错误
        if (!oauthState || !oauthState.codeVerifier) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'OAuth 状态已过期或丢失，请重新获取授权链接'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token 请求失败:', tokenResponse.status, errorText);
            return new Response(JSON.stringify({
                status: 'error',
                error: `Token 请求失败 (${tokenResponse.status}): ${errorText}`
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const tokenData = await tokenResponse.json();
        console.log('Token 响应:', tokenData);

        if (tokenData.access_token) {
            // 保存 Token 到 KV 存储
            const tokenKey = `token:${tokenData.access_token}`;
            await env.TOKENS.put(tokenKey, JSON.stringify({
                token: tokenData.access_token,
                tenant_url: tenant_url,
                remark: remark || '',
                created_at: Date.now()
            }));
            
            // OAuth 状态清理（简化版本中跳过）
            
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

// 辅助函数
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
    const bytes = Array.from(buffer);
    const binaryString = String.fromCharCode(...bytes);
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
