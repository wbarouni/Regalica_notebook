const { normalizeBase, joinUrl, parseCorsOrigins, isOriginAllowed, getPublicUrlConfig } = require('./url');

describe('URL Normalization', () => {
  test('should normalize valid HTTP URLs', () => {
    expect(normalizeBase('http://example.com')).toBe('http://example.com');
    expect(normalizeBase('https://example.com')).toBe('https://example.com');
    expect(normalizeBase('http://example.com/')).toBe('http://example.com');
    expect(normalizeBase('https://example.com/')).toBe('https://example.com');
  });

  test('should reject file:// protocol', () => {
    expect(() => normalizeBase('file:///etc/passwd')).toThrow('Protocol file:// not allowed');
  });

  test('should reject URLs without http(s)', () => {
    expect(() => normalizeBase('ftp://example.com')).toThrow('URL must start with http:// or https://');
    expect(() => normalizeBase('example.com')).toThrow('URL must start with http:// or https://');
  });

  test('should handle empty or invalid URLs', () => {
    expect(normalizeBase('')).toBe('');
    expect(normalizeBase(null)).toBe('');
    expect(normalizeBase(undefined)).toBe('');
    expect(normalizeBase('   ')).toBe('');
  });

  test('should join URLs correctly', () => {
    expect(joinUrl('http://example.com', '/api/v1')).toBe('http://example.com/api/v1');
    expect(joinUrl('http://example.com/', '/api/v1')).toBe('http://example.com/api/v1');
    expect(joinUrl('http://example.com', 'api/v1')).toBe('http://example.com/api/v1');
    expect(joinUrl('http://example.com/', 'api/v1')).toBe('http://example.com/api/v1');
  });

  test('should handle empty base or path in joinUrl', () => {
    expect(joinUrl('', '/api/v1')).toBe('/api/v1');
    expect(joinUrl('http://example.com', '')).toBe('http://example.com');
    expect(joinUrl('', '')).toBe('');
  });

  test('should parse CORS origins correctly', () => {
    const origins = parseCorsOrigins('http://localhost:3000,https://example.com,http://test.com');
    expect(origins).toEqual(['http://localhost:3000', 'https://example.com', 'http://test.com']);
  });

  test('should filter invalid origins in CORS parsing', () => {
    const origins = parseCorsOrigins('http://valid.com,file://invalid,ftp://invalid,https://valid2.com');
    expect(origins).toEqual(['http://valid.com', 'https://valid2.com']);
  });

  test('should handle empty CORS origins string', () => {
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins(null)).toEqual([]);
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  test('should allow localhost origins', () => {
    const allowedOrigins = ['https://example.com'];
    expect(isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:5200', allowedOrigins)).toBe(true);
  });

  test('should check allowed origins correctly', () => {
    const allowedOrigins = ['https://example.com', 'http://test.com'];
    expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(true);
    expect(isOriginAllowed('http://test.com', allowedOrigins)).toBe(true);
    expect(isOriginAllowed('https://malicious.com', allowedOrigins)).toBe(false);
  });

  test('should handle invalid inputs in isOriginAllowed', () => {
    expect(isOriginAllowed('', ['https://example.com'])).toBe(false);
    expect(isOriginAllowed('https://example.com', null)).toBe(false);
    expect(isOriginAllowed(null, ['https://example.com'])).toBe(false);
  });

  test('should generate public URL config', () => {
    const config = {
      backendExternalUrl: 'https://api.example.com',
      frontendExternalUrl: 'https://app.example.com',
      secretKey: 'should-not-appear'
    };

    const publicConfig = getPublicUrlConfig(config);
    
    expect(publicConfig.backend_url).toBe('https://api.example.com');
    expect(publicConfig.frontend_url).toBe('https://app.example.com');
    expect(publicConfig.api_version).toBe('1.0');
    expect(publicConfig.timestamp).toBeDefined();
    expect(publicConfig.secretKey).toBeUndefined();
  });

  test('should handle empty URLs in public config', () => {
    const config = {
      backendExternalUrl: '',
      frontendExternalUrl: ''
    };

    const publicConfig = getPublicUrlConfig(config);
    
    expect(publicConfig.backend_url).toBe('');
    expect(publicConfig.frontend_url).toBe('');
  });
});
