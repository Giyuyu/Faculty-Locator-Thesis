import { createServer } from 'vite';

const port = Number(process.env.PORT || 5173);
const server = await createServer({
  mode: 'staging',
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();
