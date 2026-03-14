/**
 * 服务器状态检查
 */
export async function checkServerStatus() {
  try {
    const response = await fetch('http://localhost:3000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { online: true, message: data.message };
    }

    return { online: false, message: `服务器响应异常 (${response.status})` };
  } catch (error) {
    return { online: false, message: '无法连接到服务器，请确保后端已启动' };
  }
}

/**
 * 显示服务器状态
 */
export async function displayServerStatus() {
  const status = await checkServerStatus();

  // 创建或更新状态指示器
  let statusEl = document.getElementById('server-status');

  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'server-status';
    statusEl.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(statusEl);
  }

  if (status.online) {
    statusEl.style.background = '#27ae60';
    statusEl.style.color = 'white';
    statusEl.textContent = '● 服务器在线';
  } else {
    statusEl.style.background = '#e74c3c';
    statusEl.style.color = 'white';
    statusEl.textContent = `● ${status.message}`;
  }

  return status.online;
}
