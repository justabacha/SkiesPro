const getBaseUrl = () => {
  const base = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const API_BASE = getBaseUrl();

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  errors?: Array<{ msg: string; param: string; location: string }>;
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    let url: string;
    if (API_BASE) {
      if (API_BASE.endsWith('/api/v1') && normalizedPath.startsWith('/api/v1')) {
        url = `${API_BASE}${normalizedPath.substring(7)}`;
      } else {
        url = `${API_BASE}${normalizedPath}`;
      }
    } else {
      url = normalizedPath;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      const apiError: ApiError = {
        message: 'An unexpected error occurred',
        status: response.status,
        code: errorData.code,
        errors: errorData.errors,
      };

      if (typeof errorData.error === 'string') {
        apiError.message = errorData.error;
      } else if (errorData.error?.message) {
        apiError.message = errorData.error.message;
      } else if (errorData.message) {
        apiError.message = errorData.message;
      } else if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        const firstError = errorData.errors[0];
        apiError.message = firstError.msg || firstError.message || apiError.message;
      }

      // Special handling for 422 Unprocessable Entity
      if (response.status === 422) {
        // Business logic errors from the hardened backend
        console.warn('Business validation error:', apiError.message);
      }

      const error = new Error(apiError.message);
      (error as any).status = apiError.status;
      (error as any).code = apiError.code;
      (error as any).errors = apiError.errors;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
