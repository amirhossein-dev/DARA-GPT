// Default/Web configuration stays in app.json. Select the isolated native test
// variant explicitly, both during the cloud build and when starting Metro.
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT;
  if (variant && variant !== 'identity-test') {
    throw new Error('Unsupported APP_VARIANT');
  }
  if (variant !== 'identity-test') return config;

  return {
    ...config,
    name: 'DARA Identity Test',
    slug: 'dara-identity-test',
    scheme: 'daraidentitytest',
    android: { ...config.android, package: 'com.anonymous.aiterminal.identitytest' },
    plugins: [
      ...(config.plugins || []),
      ['expo-dev-client', { addGeneratedScheme: false }],
    ],
  };
};
