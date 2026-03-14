/**
 * API 请求封装
 */
const API_BASE = '/api';

/**
 * 发送 API 请求
 */
async function request(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

/**
 * 认证相关 API
 */
export const authAPI = {
  // 注册
  register: (username, email, password, initialChips = 5000) => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, initialChips })
    });
  },

  // 登录
  login: (email, password) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  // 获取当前用户
  getMe: () => {
    return request('/auth/me');
  }
};

/**
 * 用户相关 API
 */
export const userAPI = {
  // 更新资料
  updateProfile: (data) => {
    return request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 获取统计
  getStats: () => {
    return request('/user/stats');
  }
};

export default { authAPI, userAPI };
