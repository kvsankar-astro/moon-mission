import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_TEST_PORT = 8111;
const DEFAULT_TEST_HOST = '127.0.0.1';
const LOCAL_CONFIG_FILE = '.test-local.json';

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getLocalTestConfig(rootDir = process.cwd()) {
  const configPath = join(rootDir, LOCAL_CONFIG_FILE);
  if (!existsSync(configPath)) {
    return {};
  }

  return readJsonFile(configPath) || {};
}

function normalizePort(value, fallback = DEFAULT_TEST_PORT) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getEffectiveTestPort(rootDir = process.cwd()) {
  const localConfig = getLocalTestConfig(rootDir);
  return normalizePort(process.env.TEST_SERVER_PORT || localConfig.testServerPort);
}

function getEffectiveTestBaseUrl(rootDir = process.cwd()) {
  const localConfig = getLocalTestConfig(rootDir);
  const configuredUrl = process.env.VITE_TEST_BASE_URL || localConfig.viteTestBaseUrl;
  if (configuredUrl) {
    return configuredUrl;
  }

  const port = getEffectiveTestPort(rootDir);
  return `http://${DEFAULT_TEST_HOST}:${port}`;
}

function getServerStatePaths(rootDir = process.cwd()) {
  const port = getEffectiveTestPort(rootDir);
  return {
    pidFile: join(rootDir, `.test-server.${port}.pid`),
    stateFile: join(rootDir, `.test-server.${port}.json`),
  };
}

export {
  DEFAULT_TEST_PORT,
  getEffectiveTestBaseUrl,
  getEffectiveTestPort,
  getLocalTestConfig,
  getServerStatePaths,
};
