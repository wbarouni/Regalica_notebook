export const environment = {
  production: false,
  apiBaseUrl: '', // L'URL du backend sera fournie dynamiquement ou via une variable d'environnement
  maxUploadMb: 100,
  pageSize: 20,
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'text/plain'
  ]
};
