import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import { openapiPath } from './config/paths.js';

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = Lowercase<(typeof httpMethods)[number]>;

interface RouteDoc {
  method: HttpMethod;
  path: string;
  description: string;
  access: string;
}

interface OpenApiOperation {
  [key: string]: unknown;
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  security?: Array<Record<string, never[]>>;
  responses: Record<string, Record<string, unknown>>;
}

export interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  servers: Array<Record<string, string>>;
  tags: Array<Record<string, unknown>>;
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  components: Record<string, unknown>;
}

const destinationSchema = {
  type: 'object',
  required: ['enabled', 'name', 'country', 'latitude', 'longitude', 'placeId', 'timezone', 'temperatureUnit', 'timeFormat'],
  properties: {
    enabled: { type: 'boolean' },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    country: { type: 'string', maxLength: 100 },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    placeId: { type: 'string', minLength: 1, maxLength: 255 },
    timezone: { type: 'string', minLength: 1, maxLength: 100 },
    temperatureUnit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    timeFormat: { type: 'string', enum: ['12', '24'], default: '24' },
  },
};

const errorResponse = {
  description: 'Error response',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

const destinationResponse = {
  description: 'Destination widget configuration',
  content: { 'application/json': { schema: destinationSchema } },
};

const routeEnhancements: Record<string, Partial<OpenApiOperation>> = {
  'get /site-settings/destination': {
    responses: { '200': destinationResponse, default: errorResponse },
  },
  'get /site-settings/destination/search': {
    parameters: [{
      name: 'q',
      in: 'query',
      required: true,
      schema: { type: 'string', minLength: 2, maxLength: 100 },
    }],
    responses: {
      '200': {
        description: 'Matching destinations',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'placeId', 'name', 'country', 'region', 'latitude', 'longitude', 'timezone'],
                properties: {
                  id: { type: 'string' },
                  placeId: { type: 'string' },
                  name: { type: 'string' },
                  country: { type: 'string' },
                  region: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  timezone: { type: 'string' },
                },
              },
            },
          },
        },
      },
      default: errorResponse,
    },
  },
  'put /site-settings/destination': {
    requestBody: {
      required: true,
      content: { 'application/json': { schema: destinationSchema } },
    },
    responses: { '200': destinationResponse, default: errorResponse },
  },
  'get /site-settings/destination/weather': {
    responses: {
      '200': {
        description: 'Current destination weather',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['temperature', 'apparentTemperature', 'weatherCode', 'description', 'isDay', 'unit'],
              properties: {
                temperature: { type: 'number' },
                apparentTemperature: { type: 'number' },
                weatherCode: { type: 'integer' },
                description: { type: 'string' },
                isDay: { type: 'boolean' },
                unit: { type: 'string', enum: ['°C', '°F'] },
              },
            },
          },
        },
      },
      default: errorResponse,
    },
  },
  'patch /posts/{id}/pin': {
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['is_pinned'],
            properties: { is_pinned: { type: 'boolean' } },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Updated post',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } },
      },
      default: errorResponse,
    },
  },
};

const tagDescriptions: Record<string, string> = {
  admin: 'Administrative operations',
  auth: 'Authentication and user management',
  comments: 'Comment management for posts',
  documents: 'Legal documents and policies',
  health: 'Service health and readiness',
  posts: 'Blog posts, categories, and tags',
  setup: 'Initial system setup',
  'signup-keys': 'Signup key management',
  'site-settings': 'Site configuration and settings',
};

function tagValue(block: string, name: string): string | undefined {
  const line = block
    .split('\n')
    .map(value => value.replace(/^\s*\*\s?/, '').trim())
    .find(value => value.startsWith(`@${name} `));
  return line?.slice(name.length + 2).trim();
}

function parseRouteDocs(source: string): RouteDoc[] {
  const docs: RouteDoc[] = [];
  for (const match of source.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
    const block = match[1] ?? '';
    const route = tagValue(block, 'route');
    if (!route) continue;

    const routeMatch = route.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/api(?:\/\S*)?)$/);
    const method = routeMatch?.[1];
    const path = routeMatch?.[2];
    if (!method || !path || !httpMethods.includes(method as (typeof httpMethods)[number])) {
      throw new Error(`Invalid @route declaration: ${route}`);
    }

    docs.push({
      method: method.toLowerCase() as HttpMethod,
      path,
      description: tagValue(block, 'desc') ?? 'API operation',
      access: tagValue(block, 'access') ?? 'Unspecified',
    });
  }
  return docs;
}

function operationId(method: HttpMethod, path: string): string {
  const words = path.replace(/^\/api\/?/, '').match(/[A-Za-z0-9]+/g) ?? [];
  return method + words.map(word => word[0]?.toUpperCase() + word.slice(1)).join('');
}

function pathParameters(path: string): Array<Record<string, unknown>> {
  return [...path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map(match => {
    const name = match[1] ?? '';
    return {
      name,
      in: 'path',
      required: true,
      schema: /(?:^id$|Id$)/.test(name)
        ? { type: 'integer', minimum: 1 }
        : { type: 'string' },
    };
  });
}

function requiresAuthentication(access: string): boolean {
  return !/^Public\b/i.test(access) && !/^Public or authenticated\b/i.test(access);
}

function toOpenApiPath(routePath: string): string {
  const withoutPrefix = routePath.replace(/^\/api(?=\/|$)/, '') || '/';
  return withoutPrefix.replace(/:([A-Za-z][A-Za-z0-9]*)/g, '{$1}');
}

function sourceFiles(): string[] {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const extension = extname(fileURLToPath(import.meta.url));
  const routesDir = resolve(serverDir, 'routes');
  const routeFiles = readdirSync(routesDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && extname(entry.name) === extension)
    .map(entry => resolve(routesDir, entry.name));
  return [resolve(serverDir, `main${extension}`), ...routeFiles];
}

export function generateOpenApiDocument(): OpenApiDocument {
  const document = loadYaml(readFileSync(openapiPath, 'utf8')) as OpenApiDocument;
  if (!document || typeof document !== 'object' || !document.paths || !Array.isArray(document.tags)) {
    throw new Error('openapi.yaml does not contain a valid OpenAPI document');
  }

  const tags = new Set(document.tags.flatMap(tag => typeof tag.name === 'string' ? [tag.name] : []));

  for (const file of sourceFiles()) {
    for (const route of parseRouteDocs(readFileSync(file, 'utf8'))) {
      const path = toOpenApiPath(route.path);
      const tag = path.split('/').filter(Boolean)[0] ?? 'health';
      const parameters = pathParameters(route.path);
      const enhancement = routeEnhancements[`${route.method} ${path}`];
      const operation: OpenApiOperation = {
        tags: [tag],
        summary: route.description.replace(/\.$/, ''),
        description: `${route.description}\n\nAccess: ${route.access}`,
        operationId: operationId(route.method, route.path),
        responses: {
          '200': { description: 'Successful response' },
          default: {
            description: 'Error response',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
        ...enhancement,
      };
      if (parameters.length) operation.parameters = [...parameters, ...(enhancement?.parameters ?? [])];
      if (requiresAuthentication(route.access)) operation.security = [{ bearerAuth: [] }];

      const pathItem = document.paths[path] ?? {};
      if (!pathItem[route.method]) {
        pathItem[route.method] = operation;
        document.paths[path] = pathItem;
      }
      tags.add(tag);
    }
  }

  const existingTags = new Set(document.tags.flatMap(tag => typeof tag.name === 'string' ? [tag.name] : []));
  document.tags.push(...[...tags]
    .filter(name => !existingTags.has(name))
    .sort()
    .map(name => ({ name, description: tagDescriptions[name] ?? `${name} operations` })));
  return document;
}
