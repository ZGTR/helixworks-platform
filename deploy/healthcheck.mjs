import http from 'node:http';
import process from 'node:process';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  process.stderr.write('PORT must be an integer between 1 and 65535\n');
  process.exit(1);
}

const request = http.get(
  {
    host: '127.0.0.1',
    port,
    path: '/health',
    timeout: 4_000,
    headers: { accept: 'application/json' },
  },
  (response) => {
    response.resume();
    if (
      response.statusCode !== undefined &&
      response.statusCode >= 200 &&
      response.statusCode < 300
    ) {
      process.exit(0);
    }
    process.stderr.write(`health endpoint returned ${String(response.statusCode)}\n`);
    process.exit(1);
  },
);

request.on('timeout', () => request.destroy(new Error('health request timed out')));
request.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
