function normalizeToolingPath(pathValue) {
  if (typeof pathValue !== 'string' || process.platform !== 'win32') {
    return pathValue;
  }

  if (pathValue.startsWith('\\\\?\\') && /^[A-Za-z]:\\/.test(pathValue.slice(4))) {
    return pathValue.slice(4);
  }

  return pathValue;
}

export { normalizeToolingPath };
