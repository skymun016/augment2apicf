package api

import (
	"augment-token-manager/config"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// TokenInfo 存储token信息
type TokenInfo struct {
	Token     string `json:"token"`
	TenantURL string `json:"tenant_url"`
	Remark    string `json:"remark"`
}

// CallbackRequest 回调请求结构
type CallbackRequest struct {
	Code      string `json:"code" binding:"required"`
	TenantURL string `json:"tenant_url" binding:"required"`
}

// GetTokensHandler 获取token列表
func GetTokensHandler(c *gin.Context) {
	// 获取所有token的key
	keys, err := config.RedisKeys("token:*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "获取token列表失败: " + err.Error(),
		})
		return
	}

	// 如果没有token
	if len(keys) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"tokens": []TokenInfo{},
			"total":  0,
		})
		return
	}

	// 对keys进行排序，确保顺序稳定
	sort.Sort(sort.Reverse(sort.StringSlice(keys)))

	var tokenList []TokenInfo
	for _, key := range keys {
		// 从key中提取token (格式: "token:{token}")
		token := key[6:] // 去掉前缀 "token:"

		// 获取token信息
		fields, err := config.RedisHGetAll(key)
		if err != nil {
			continue // 跳过无效的token
		}

		// 检查必要字段
		tenantURL, ok := fields["tenant_url"]
		if !ok {
			continue
		}

		// 获取备注信息
		remark := fields["remark"]

		tokenList = append(tokenList, TokenInfo{
			Token:     token,
			TenantURL: tenantURL,
			Remark:    remark,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"tokens": tokenList,
		"total":  len(tokenList),
	})
}

// SaveTokenToRedis 保存token到Redis
func SaveTokenToRedis(token, tenantURL string) error {
	// 创建一个唯一的key
	tokenKey := "token:" + token

	// 检查token是否已存在
	exists, err := config.RedisExists(tokenKey)
	if err != nil {
		return err
	}
	if exists {
		return nil // 已存在，跳过
	}

	// 保存tenant_url
	err = config.RedisHSet(tokenKey, "tenant_url", tenantURL)
	if err != nil {
		return err
	}

	// 初始化备注为空字符串
	return config.RedisHSet(tokenKey, "remark", "")
}

// CallbackHandler 处理OAuth回调，获取access token
func CallbackHandler(c *gin.Context, getAccessTokenFunc func(string, string, string) (string, error)) {
	var req CallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"error":  "无效的请求数据",
		})
		return
	}

	// 使用授权码获取访问令牌
	token, err := getAccessTokenFunc(req.TenantURL, "", req.Code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "获取访问令牌失败: " + err.Error(),
		})
		return
	}

	// 保存到Redis
	if err := SaveTokenToRedis(token, req.TenantURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "保存token失败: " + err.Error(),
		})
		return
	}

	logrus.WithFields(logrus.Fields{
		"token":      token[:10] + "...", // 只记录前10位
		"tenant_url": req.TenantURL,
	}).Info("成功获取并保存token")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  token,
	})
}

// DeleteTokenHandler 删除指定的token
func DeleteTokenHandler(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"error":  "未指定token",
		})
		return
	}

	tokenKey := "token:" + token

	// 检查token是否存在
	exists, err := config.RedisExists(tokenKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "检查token失败: " + err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status": "error",
			"error":  "token不存在",
		})
		return
	}

	// 删除token
	if err := config.RedisDel(tokenKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "删除token失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

// UpdateTokenRemarkHandler 更新token备注
func UpdateTokenRemarkHandler(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"error":  "未指定token",
		})
		return
	}

	var req struct {
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"error":  "无效的请求数据",
		})
		return
	}

	tokenKey := "token:" + token

	// 检查token是否存在
	exists, err := config.RedisExists(tokenKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "检查token失败: " + err.Error(),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"status": "error",
			"error":  "token不存在",
		})
		return
	}

	// 更新备注
	err = config.RedisHSet(tokenKey, "remark", req.Remark)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  "更新备注失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
	})
}

// AuthHandler 返回授权URL
func AuthHandler(c *gin.Context, authorizeURL string) {
	c.JSON(http.StatusOK, gin.H{
		"status":        "success",
		"authorize_url": authorizeURL,
	})
}
