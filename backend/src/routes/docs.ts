import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';

export const docsRouter = Router();

const openApiPath = fileURLToPath(new URL('../../../docs/openapi.yaml', import.meta.url));

const SCALAR_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NgeTarget Saham — API Documentation</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/openapi.yaml"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

docsRouter.get('/openapi.yaml', async (_req, res, next) => {
  try {
    const yaml = await readFile(openApiPath, 'utf8');
    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    res.send(yaml);
  } catch (err) {
    next(err);
  }
});

docsRouter.get('/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(SCALAR_HTML);
});
