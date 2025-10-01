export const environment = {
  production: false,
  // apiBaseUrl supprimé - sera chargé dynamiquement via /api/config
  maxUploadMb: 100,
  pageSize: 20,
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'text/plain'
  ]
};
