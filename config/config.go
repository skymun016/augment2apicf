package config

import (
	"os"
)

// AppConfig 应用配置
type Config struct {
	RedisConnString string
	AccessPwd       string
	Port            string
}

var AppConfig Config

// InitConfig 初始化配置
func InitConfig() error {
	AppConfig = Config{
		RedisConnString: getEnv("REDIS_CONN_STRING", ""),
		AccessPwd:       getEnv("ACCESS_PWD", ""),
		Port:            getEnv("PORT", "8080"),
	}
	return nil
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
