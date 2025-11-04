module.exports = {
  apps: [
    {
      name: 'ai-interviewer-backend',
      cwd: '/home/ubuntu/ec2-deployed-working-interviewer/backend',
      script: 'venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      log_file: '/home/ubuntu/backend.log',
      out_file: '/home/ubuntu/backend-out.log',
      error_file: '/home/ubuntu/backend-error.log'
    }
  ]
};
