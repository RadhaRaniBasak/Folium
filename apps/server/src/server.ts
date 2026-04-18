import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { createApp } from './app';

async function start(): Promise<void> {
  await connectDB();
  await connectRedis();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`🚀 Folium server running on http://localhost:${env.PORT}`);
    console.log(`   Health: http://localhost:${env.PORT}/api/health`);
  });
}

start().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
