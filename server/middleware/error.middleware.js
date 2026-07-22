// Error handling middleware
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const isDev = process.env.NODE_ENV === 'development';
  const status = err.status || 500;
  const clientMessage =
    status < 500
      ? err.message || 'Request error'
      : isDev
        ? err.message || 'Internal server error'
        : 'Internal server error';

  res.status(status).json({
    success: false,
    error: clientMessage,
    ...(isDev && { stack: err.stack }),
  });
}

// 404 handler
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
