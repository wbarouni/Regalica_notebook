class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ 
      error: err.message, 
      code: err.code 
    });
  }

  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    code: "INTERNAL_ERROR" 
  });
};

module.exports = { AppError, errorHandler };
