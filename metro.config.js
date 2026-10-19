const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const blobDist = path.dirname(require.resolve('@vercel/blob/client'));
const browserShims = {
  undici: path.join(blobDist, 'undici-browser.js'),
  crypto: path.join(blobDist, 'crypto-browser.js'),
  stream: path.join(blobDist, 'stream-browser.js')
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && browserShims[moduleName]) {
    return context.resolveRequest(context, browserShims[moduleName], platform);
  }
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
