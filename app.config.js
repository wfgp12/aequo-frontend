// Extiende app.json. El google-services.json no se versiona: en EAS llega como variable de archivo GOOGLE_SERVICES_JSON.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
