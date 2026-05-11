export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
    path: string;
    timestamp: string;
    locale: 'fa';
  };
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    statusCode: number;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    path: string;
    timestamp: string;
    locale: 'fa';
  };
};
