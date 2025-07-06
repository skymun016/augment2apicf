package main

import (
	"augment-token-manager/api"
	"augment-token-manager/config"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const clientID = "v"

// OAuthState 存储OAuth状态信息
type OAuthState struct {
	CodeVerifier  string    `json:"code_verifier"`
	CodeChallenge string    `json:"code_challenge"`
	State         string    `json:"state"`
	CreationTime  time.Time `json:"creation_time"`
}

// 全局变量存储OAuth状态
var globalOAuthState OAuthState

// base64URLEncode 编码Buffer为base64 URL安全格式
func base64URLEncode(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	encoded = strings.ReplaceAll(encoded, "+", "-")
	encoded = strings.ReplaceAll(encoded, "/", "_")
	encoded = strings.ReplaceAll(encoded, "=", "")
	return encoded
}

// sha256Hash 计算SHA256哈希
func sha256Hash(input []byte) []byte {
	hash := sha256.Sum256(input)
	return hash[:]
}

// createOAuthState 创建OAuth状态
func createOAuthState() OAuthState {
	codeVerifierBytes := make([]byte, 32)
	_, err := rand.Read(codeVerifierBytes)
	if err != nil {
		logrus.Fatalf("生成随机字节失败: %v", err)
	}

	codeVerifier := base64URLEncode(codeVerifierBytes)
	codeChallenge := base64URLEncode(sha256Hash([]byte(codeVerifier)))

	stateBytes := make([]byte, 8)
	_, err = rand.Read(stateBytes)
	if err != nil {
		logrus.Fatalf("生成随机状态失败: %v", err)
	}
	state := base64URLEncode(stateBytes)

	return OAuthState{
		CodeVerifier:  codeVerifier,
		CodeChallenge: codeChallenge,
		State:         state,
		CreationTime:  time.Now(),
	}
}

// generateAuthorizeURL 生成授权URL
func generateAuthorizeURL(oauthState OAuthState) string {
	params := url.Values{}
	params.Add("response_type", "code")
	params.Add("code_challenge", oauthState.CodeChallenge)
	params.Add("client_id", clientID)
	params.Add("state", oauthState.State)
	params.Add("prompt", "login")

	authorizeURL := fmt.Sprintf("https://auth.augmentcode.com/authorize?%s", params.Encode())
	return authorizeURL
}

// getAccessToken 获取访问令牌
func getAccessToken(tenantURL, codeVerifier, code string) (string, error) {
	data := map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     clientID,
		"code_verifier": codeVerifier,
		"redirect_uri":  "",
		"code":          code,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("序列化数据失败: %v", err)
	}

	resp, err := http.Post(tenantURL+"token", "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return "", fmt.Errorf("请求令牌失败: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败: %v", err)
	}

	token, ok := result["access_token"].(string)
	if !ok {
		return "", fmt.Errorf("响应中没有访问令牌")
	}

	return token, nil
}

// setupRouter 初始化路由
func setupRouter() *gin.Engine {
	r := gin.Default()

	// 跨域配置
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowCredentials = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"*"}
	r.Use(cors.New(corsConfig))

	// 初始化OAuth状态
	globalOAuthState = createOAuthState()

	// 静态文件服务
	r.Static("/static", "./static")
	r.LoadHTMLGlob("templates/*")

	// 登录页面
	r.GET("/login", func(c *gin.Context) {
		c.HTML(http.StatusOK, "login.html", gin.H{})
	})

	// 登录API
	r.POST("/api/login", api.LoginHandler)
	r.POST("/api/logout", api.LogoutHandler)

	// 主页面 - 需要会话验证
	r.GET("/", func(c *gin.Context) {
		// 如果设置了访问密码，检查是否已登录
		if config.AppConfig.AccessPwd != "" {
			token := c.Query("token")
			if token == "" {
				token, _ = c.Cookie("auth_token")
			}
			if token == "" {
				token = c.GetHeader("X-Auth-Token")
			}

			if !api.ValidateToken(token) {
				c.Redirect(http.StatusFound, "/login")
				return
			}
		}
		c.HTML(http.StatusOK, "index.html", gin.H{})
	})

	// API路由组 - 需要会话验证
	apiGroup := r.Group("/api")
	apiGroup.Use(api.AuthMiddleware())
	{
		// 获取授权URL
		apiGroup.GET("/auth", func(c *gin.Context) {
			authorizeURL := generateAuthorizeURL(globalOAuthState)
			api.AuthHandler(c, authorizeURL)
		})

		// 处理授权码回调
		apiGroup.POST("/callback", func(c *gin.Context) {
			api.CallbackHandler(c, func(tenantURL, _, code string) (string, error) {
				return getAccessToken(tenantURL, globalOAuthState.CodeVerifier, code)
			})
		})

		// Token管理
		apiGroup.GET("/tokens", api.GetTokensHandler)
		apiGroup.DELETE("/token/:token", api.DeleteTokenHandler)
		apiGroup.PUT("/token/:token/remark", api.UpdateTokenRemarkHandler)
	}

	return r
}

func main() {
	// 设置日志格式
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	// 设置 Gin 为发布模式
	gin.SetMode(gin.ReleaseMode)

	// 初始化配置
	err := config.InitConfig()
	if err != nil {
		logrus.Fatalf("failed to initialize config: %v", err)
	}

	// 初始化Redis
	err = config.InitRedisClient()
	if err != nil {
		logrus.Fatalf("failed to initialize Redis: %v", err)
	}

	r := setupRouter()

	// 启动服务器
	port := ":" + config.AppConfig.Port
	logrus.Infof("Augment Token Manager 启动在端口 %s", config.AppConfig.Port)
	if err := r.Run(port); err != nil {
		logrus.Fatalf("启动服务失败: %v", err)
	}
}
