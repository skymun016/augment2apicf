package config

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

var RDB redis.Cmdable

// InitRedisClient 初始化Redis客户端
func InitRedisClient() error {
	if AppConfig.RedisConnString == "" {
		logrus.Debug("REDIS_CONN_STRING not set, Redis is not enabled")
		return nil
	}

	opt, err := redis.ParseURL(AppConfig.RedisConnString)
	if err != nil {
		logrus.Fatalf("failed to parse Redis connection string: %v", err)
	}
	RDB = redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = RDB.Ping(ctx).Result()
	if err != nil {
		logrus.Fatalf("Redis ping test failed: %v", err)
	}
	return err
}

// Redis操作函数
func RedisSet(key string, value string, expiration time.Duration) error {
	ctx := context.Background()
	return RDB.Set(ctx, key, value, expiration).Err()
}

func RedisGet(key string) (string, error) {
	ctx := context.Background()
	return RDB.Get(ctx, key).Result()
}

func RedisDel(key string) error {
	ctx := context.Background()
	return RDB.Del(ctx, key).Err()
}

func RedisHSet(key, field, value string) error {
	ctx := context.Background()
	return RDB.HSet(ctx, key, field, value).Err()
}

func RedisHGet(key, field string) (string, error) {
	ctx := context.Background()
	return RDB.HGet(ctx, key, field).Result()
}

func RedisHGetAll(key string) (map[string]string, error) {
	ctx := context.Background()
	return RDB.HGetAll(ctx, key).Result()
}

func RedisExists(key string) (bool, error) {
	ctx := context.Background()
	result, err := RDB.Exists(ctx, key).Result()
	return result > 0, err
}

func RedisKeys(pattern string) ([]string, error) {
	ctx := context.Background()
	return RDB.Keys(ctx, pattern).Result()
}
