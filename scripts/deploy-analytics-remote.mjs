import { Client } from 'ssh2';

const host = process.env.DEPLOY_HOST ?? '195.201.128.118';
const password = process.env.SSH_PASS ?? '';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'MyAssistant-Admin-2026';
const apiKey = process.env.ANALYTICS_API_KEY ?? 'myassistant-analytics-key';

if (!password) {
  console.error('SSH_PASS missing');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream
        .on('close', (code) => {
          if (code !== 0) reject(new Error(`Exit ${code}: ${errOut || out}`));
          else resolve(out);
        })
        .on('data', (d) => {
          out += d.toString();
          process.stdout.write(d);
        })
        .stderr.on('data', (d) => {
          errOut += d.toString();
          process.stderr.write(d);
        });
    });
  });
}

const conn = new Client();

conn.on('ready', async () => {
  try {
    console.log('=== SSH OK ===\n');
    await exec(conn, 'docker --version || (apt-get update && apt-get install -y docker.io docker-compose-v2)');
    await exec(
      conn,
      'test -d /opt/myassistant-analytics && cd /opt/myassistant-analytics && git pull || (rm -rf /opt/myassistant-analytics && git clone --depth 1 https://github.com/Abdisefta/MyAssistant.git /opt/myassistant-analytics-repo && cp -r /opt/myassistant-analytics-repo/analytics-server /opt/myassistant-analytics && rm -rf /opt/myassistant-analytics-repo)',
    );
    const envContent = `ADMIN_PASSWORD=${adminPassword}
ANALYTICS_API_KEY=${apiKey}
TTS_HEALTH_URL=http://127.0.0.1:3001/health
`;
    await exec(
      conn,
      `cat > /opt/myassistant-analytics/.env << 'EOF'\n${envContent}EOF`,
    );
    await exec(conn, 'cd /opt/myassistant-analytics && docker compose up -d --build');
    await exec(
      conn,
      'command -v ufw >/dev/null && (ufw allow 3002/tcp || true) || true',
    );
    await exec(conn, 'curl -fsS http://127.0.0.1:3002/health || curl -fsS http://127.0.0.1:3002/health');
    console.log('\n=== KLAR ===');
    console.log(`Dashboard: http://${host}:3002`);
    console.log(`Admin password: ${adminPassword}`);
  } catch (e) {
    console.error('\nDeploy failed:', e.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
});

conn.on('error', (e) => {
  console.error('SSH error:', e.message);
  process.exit(1);
});

conn.connect({ host, port: 22, username: 'root', password, readyTimeout: 20000 });
