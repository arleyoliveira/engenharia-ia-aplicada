import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { bragGeneratorFlow } from './flows';

const browserDistFolder = join(import.meta.dirname, '../browser');

const server = express();
server.use(express.json());

server.post('/api/brag', async (req, res) => {
  try {
    const { definition } = req.body;
    const result = await bragGeneratorFlow({ definition: req.body.definition });
    res.json(result);
  } catch (error) {
    console.error('Erro ao executar bragGeneratorFlow:', error);
    res.status(500).json({ error: 'Erro ao gerar o Brag Document' });
  }
});

const angularApp = new AngularNodeAppEngine();

/**
 * Serve static files from /browser
 */
server.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
server.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  server.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(server);

