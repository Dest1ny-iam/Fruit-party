import Vue from 'vue'
import App from './App.vue'
import './styles/base.css'

new Vue({
  render: (createElement) => createElement(App),
  // 将根组件 App 挂到 index.html 的 <div id="app"> 中。
}).$mount('#app')
