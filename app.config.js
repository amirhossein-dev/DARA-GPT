// Default/Web configuration stays in app.json. Select the isolated native test
// variant explicitly, both during the cloud build and when starting Metro.
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT

  if (variant && variant !== 'identity-test') {
    throw new Error('Unsupported APP_VARIANT')
  }

  if (variant !== 'identity-test') return config

  return {
    ...config,

    owner: 'saffarnias-team',
    name: 'DARA Identity Test',
    slug: 'dara-governance',
    scheme: 'daraidentitytest',

    android: {
      ...config.android,
      package: 'com.anonymous.aiterminal.identitytest'
    },

    extra: {
      ...(config.extra || {}),
      eas: {
        ...(config.extra?.eas || {}),
        projectId: '427caac2-75c8-49e9-9b56-7c7d28e99e05'
      }
    },

    plugins: [...(config.plugins || []), ['expo-dev-client', { addGeneratedScheme: false }]]
  }
}
