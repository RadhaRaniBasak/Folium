import express from 'express';
import cors from 'cors';
import { APP_NAME, DEFAULT_PORT, ROUTES, HTTP_STATUS } from '@repo/shared';
import type { HealthResponse, ApiResponse } from '@repo/shared';

const app = express();

app.use(cors());
app.use(express.json());

// Health check route
app.get(ROUTES.HEALTH, (_req, res) => {
  const response: ApiResponse<HealthResponse> = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
  res.status(HTTP_STATUS.OK).json(response);
});

// Root route
app.get('/', (_req, res) => {
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: `Welcome to ${APP_NAME} API` },
  };
  res.status(HTTP_STATUS.OK).json(response);
});

const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : DEFAULT_PORT;

app.listen(port, () => {
  console.log(`🚀 ${APP_NAME} server running on http://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}${ROUTES.HEALTH}`);
});
