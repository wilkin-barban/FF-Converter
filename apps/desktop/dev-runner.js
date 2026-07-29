const { createServer } = require('vite');
const { spawn, execSync } = require('child_process');
const path = require('path');

async function run() {
  console.log('[DevRunner] Compiling main & preload TypeScript...');
  try {
    execSync('npx tsc -p tsconfig.main.json', { cwd: __dirname, stdio: 'inherit' });
  } catch (err) {
    console.error('[DevRunner] TypeScript build error:', err);
    process.exit(1);
  }

  console.log('[DevRunner] Starting Vite Dev Server programmatically...');
  const server = await createServer({
    configFile: path.join(__dirname, 'vite.config.ts'),
    root: __dirname,
    server: { port: 5173 },
    optimizeDeps: { force: true }
  });

  await server.listen();
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`[DevRunner] Vite Dev Server listening at ${url}`);

  console.log('[DevRunner] Launching Electron Window...');
  const electronBin = require('electron');

  const electronProcess = spawn(electronBin, ['.'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url
    }
  });

  electronProcess.on('close', (code) => {
    console.log(`[DevRunner] Electron window closed (code ${code}). Closing Vite server...`);
    server.close();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('[DevRunner] Fatal error:', err);
  process.exit(1);
});
