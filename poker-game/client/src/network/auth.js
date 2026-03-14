/**
 * 认证工具类
 */
class Auth {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.listeners = [];
  }

  /**
   * 登录
   */
  async login(email, password) {
    const { authAPI } = await import('./api.js');
    const response = await authAPI.login(email, password);

    this.token = response.token;
    this.user = response.user;

    localStorage.setItem('token', this.token);
    localStorage.setItem('user', JSON.stringify(this.user));

    this.notifyListeners();
    return response;
  }

  /**
   * 注册
   */
  async register(username, email, password, initialChips) {
    const { authAPI } = await import('./api.js');
    const response = await authAPI.register(username, email, password, initialChips);

    this.token = response.token;
    this.user = response.user;

    localStorage.setItem('token', this.token);
    localStorage.setItem('user', JSON.stringify(this.user));

    this.notifyListeners();
    return response;
  }

  /**
   * 登出
   */
  logout() {
    this.token = null;
    this.user = null;

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    this.notifyListeners();
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * 获取当前用户
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * 获取Token
   */
  getToken() {
    return this.token;
  }

  /**
   * 更新用户信息
   */
  updateUser(user) {
    this.user = { ...this.user, ...user };
    localStorage.setItem('user', JSON.stringify(this.user));
    this.notifyListeners();
  }

  /**
   * 添加监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    for (const callback of this.listeners) {
      callback(this.user);
    }
  }
}

// 导出单例
export const auth = new Auth();
export default auth;
