module.exports = {
  apps: [{
    name: 'bypasser', cwd: __dirname, script: 'src/index.js',
    // One process owns the gateway bot and in-memory rate limits.
    instances: 1, exec_mode: 'fork', autorestart: true,
    max_memory_restart: '300M', kill_timeout: 15000,
    min_uptime: '10s', max_restarts: 10,
    env_production: { NODE_ENV: 'production' },
    time: true, out_file: './logs/pm2-out.log', error_file: './logs/pm2-error.log'
  }]
};
