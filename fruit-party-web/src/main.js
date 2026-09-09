// 从 node_modules 中引入 Vue 2 的构造函数。
// Vue 是创建根实例、管理响应式数据和渲染组件的核心对象。
import Vue from 'vue'

// 引入整个应用的根组件。
// App.vue 会继续引入登录页、大厅和关卡选择页等子组件。
import App from './App.vue'

// 引入全局 CSS。
// 这里的样式不属于某一个组件，会对整个应用生效。
import './styles/base.css'

// new Vue(...) 创建一个 Vue 根实例。
new Vue({
  // render 是 Vue 2 推荐的渲染方式。
  // createElement 是 Vue 提供的函数，用来创建虚拟 DOM 节点。
  // createElement(App) 的意思是：把 App.vue 创建成页面根节点。
  render: (createElement) => createElement(App),
  // $mount('#app') 把上面生成的 App 组件挂到 index.html 的 #app 元素。
  // 这一步完成后，用户才能在浏览器中看到 Vue 生成的页面。
}).$mount('#app')
