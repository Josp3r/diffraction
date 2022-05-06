# Quill Modules

通过模块可以自定义Quill的行为和功能。官方提供了几个可选模块，其中一些支持附加的设置选项和API。具体详情可参考各自的文档。
只需要在Quill的配置中包含对应模块即可启用。

```js
var quill = new Quill('#editor', {
  modules: {
    'history': {          // Enable with custom configurations
      'delay': 2500,
      'userOnly': true
    },
    'syntax': true        // Enable with default configuration
  }
});
```

Quill已经内置了Clipboard、Keyboard和History模块，不需要再显示的包含，但需要像其他模块一样设置。

## 继承

模块可以被继承和重写来替换原来的模块，甚至内置模块也可以被重写和替换。

```js
var Clipboard = Quill.import('modules/clipboard');
var Delta = Quill.import('delta');

class PlainClipboard extends Clipboard {
  convert(html = null) {
    if (typeof html === 'string') {
      this.container.innerHTML = html;
    }
    let text = this.container.innerText;
    this.container.innerHTML = '';
    return new Delta().insert(text);
  }
}

Quill.register('modules/clipboard', PlainClipboard, true);

// Will be created with instance of PlainClipboard
var quill = new Quill('#editor');
```

*注意:选择这个示例只是为了展示其用法，使用现有模块的API和配置通常更简单。
在这个示例里面，Clipboard的addMatcher接口就能满足大部分自定义粘贴应用场景。
