# NPM

您不能0.2.1-alpha自动设置，但0.2.1-alpha.0可以。

npm 支持--preid指定预发布前缀的选项。它可以与pre*版本结合使用。

示例 1.制作下一个主要版本的 alpha：

1.2.3 => 2.0.0-alpha.0

npm version premajor --preid alpha
示例 2. 将alpha 转换为 beta：

2.0.0-alpha.0 => 2.0.0-beta.0

npm version prerelease --preid beta
创建预发布后，您可以使用prerelease参数增加数字。

2.0.0-beta.0 => 2.0.0-beta.1

npm version prerelease
