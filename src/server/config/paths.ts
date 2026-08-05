import { resolve } from 'node:path';

export const projectRoot = resolve(process.cwd());
export const attachmentsDir = resolve(projectRoot, 'storage/attachments');
export const clientDistDir = resolve(projectRoot, 'dist/client');
export const documentsDir = resolve(projectRoot, 'content/documents');
export const openapiPath = resolve(projectRoot, 'openapi.yaml');
