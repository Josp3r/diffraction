# Quill Register

注册一个模块、主题或格式，让它们可用于添加到编辑器上。注册之后，可用Quill.import引入。使用'formats/', 'modules/'或'themes/' 路径前缀来分别注册格式、模块和主题。对于格式，特有一个简短的方法，只需要传入格式对象，路径将会自动生成。如果传入路径将会直接覆盖已经定义的路径。

```js
Quill.register(format: Attributor | BlotDefinintion, supressWarning: Boolean = false)
Quill.register(path: String, def: any, supressWarning: Boolean = false)
Quill.register(defs: { [String]: any }, supressWarning: Boolean = false)
```

```js
var Module = Quill.import('core/module');

class CustomModule extends Module {}

Quill.register('modules/custom-module', CustomModule);
Quill.register({
  'formats/custom-format': CustomFormat,
  'modules/custom-module-a': CustomModuleA,
  'modules/custom-module-b': CustomModuleB,
});

Quill.register(CustomFormat);
// You cannot do Quill.register(CustomModuleA); as CustomModuleA is not a format
```
