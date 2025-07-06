package api

import (
	"augment-token-manager/config"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

const TokenKey = "session_token:"

// LoginRequest 登录请求结构
type LoginRequest struct {
	Password string `json:"password" binding:"required"`
}

// generateSessionToken 生成会话令牌
func generateSessionToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)
}

// LoginHandler 处理登录请求
func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"error":  "无效的请求数据",
		})
		return
	}

	// 验证密码
	if req.Password == config.AppConfig.AccessPwd {
		// 生成会话令牌
		token := generateSessionToken()

		// 将会话令牌保存到Redis，有效期24小时
		sessionKey := TokenKey + token
		err := config.RedisSet(sessionKey, "valid", 24*time.Hour)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"error":  "保存会话失败: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"token":  token,
		})
		return
	}

	// 密码错误
	c.JSON(http.StatusUnauthorized, gin.H{
		"status": "error",
		"error":  "密码错误",
	})
}

// LogoutHandler 处理登出请求
func LogoutHandler(c *gin.Context) {
	token := c.GetHeader("X-Auth-Token")
	if token == "" {
		token = c.Query("token")
	}
	if token == "" {
		token, _ = c.Cookie("auth_token")
	}

	if token != "" {
		sessionKey := TokenKey + token
		config.RedisDel(sessionKey)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

// ValidateToken 验证Token
func ValidateToken(token string) bool {
	if token == "" {
		return false
	}

	// 检查Redis中是否存在该token
	tokenKey := TokenKey + token
	exists, err := config.RedisExists(tokenKey)
	if err != nil || !exists {
		return false
	}

	return true
}

// AuthMiddleware 会话认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 如果未设置访问密码，则不需要验证
		if config.AppConfig.AccessPwd == "" {
			c.Next()
			return
		}

		// 从查询参数或Cookie中获取会话令牌
		token := c.GetHeader("X-Auth-Token")
		if token == "" {
			token = c.Query("token")
		}
		if token == "" {
			token, _ = c.Cookie("auth_token")
		}

		// 验证会话令牌
		if !ValidateToken(token) {
			logrus.Info("无效的会话令牌:", token)
			c.Redirect(http.StatusFound, "/login?error=token_expired")
			c.Abort()
			return
		}

		c.Next()
	}
}
