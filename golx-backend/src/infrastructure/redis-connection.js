function redisConnectionFromUrl(redisUrlValue) {
    const redisUrl = new URL(redisUrlValue);
    return {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port || '6379', 10),
        ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
        ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
        ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
    };
}

module.exports = redisConnectionFromUrl;
