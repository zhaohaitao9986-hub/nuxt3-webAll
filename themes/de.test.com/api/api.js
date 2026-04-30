// 获取用户数据
export function getUserInfo() {
  return useApiServer('/users')
}

// 获取开发者数据
export function settUserInfo() {
  return useApiClient().request('/users', 'POST', {
    "name": "张三",
    "email": "111test@qq.com"
  })
}


// 获取tools数据
export function getToolsInfo() {
  return useApiServer('/tools')
}