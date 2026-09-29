const axios = require('axios');

const nibss = axios.create({
  baseURL: process.env.NIBSS_BASE_URL,
  timeout: 15000,
});

let cachedToken = null;
let tokenExpiresAt = 0;

async function getProviderToken() {
  // Refresh before the provider's one-hour token expires.
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await nibss.post('/api/auth/token', {
    apiKey: process.env.NIBSS_API_KEY,
    apiSecret: process.env.NIBSS_API_SECRET,
  });

  if (!response.data?.token) {
    throw new Error('Provider login did not return a token');
  }

  cachedToken = response.data.token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

async function providerRequest(config) {
  const token = await getProviderToken();

  try {
    return await nibss.request({
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    // If the provider invalidated its token early, log in once more.
    if (error.response?.status !== 401) throw error;

    cachedToken = null;
    tokenExpiresAt = 0;
    const freshToken = await getProviderToken();

    return nibss.request({
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${freshToken}`,
      },
    });
  }
}

module.exports = { providerRequest };