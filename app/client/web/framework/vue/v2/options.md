# Vuejs v2 Options

## 注册类选项

* name 名称，不配置时，以父组件注册时的tagName作为组件名称
* components 子组件注册对象，注册后可以在template中嵌套使用子组件
* directives 指令注册对象，注册后可以使用自定义指令
* props 组件接收传值的参数配置对象，父组件可以传值给此组件
* data 组件scope 响应式数据配置
* methods 组件handler配置对象
* computed 组件get 数据配置
* watch 组件watcher注册对象

## 生命周期（Life Circle）

1. beforeCreate 组件Model 初始化前
2. created 组件Model 初始化完成
3. beforeMount 组件View Model（Virtual Dom）挂载前
4. mounted 组件View Model（Virtual Dom）挂在完成
5. beforeUpdate 数据更新前
6. updated 数据更新完成
7. beforeDestroy 组件unmount 前
8. destroyed 组件unmount 完成
