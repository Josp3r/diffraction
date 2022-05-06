# Quill Keyboard

键盘模块可以通过addBinding API进行键盘按键事件绑定。
可以实现选中一个range时，通过组合键的形式对该选区进行format

```js
quill.keyboard.addBinding({
  key: 'B',
  shortKey: true
}, function(range, context) {
  this.quill.formatText(range, 'bold', true);
});

// addBinding may also be called with one parameter,
// in the same form as in initialization
quill.keyboard.addBinding({
  key: 'B',
  shortKey: true,
  handler: function(range, context) {

  }
});
```