# Xcode 的命令行工具

## 在模拟器中安装本地app

以Expo App举例

```shell
# 安装expo App
xcrun simctl install booted Exponent-2.33.16.app
```

### Expo App 手动安装方法

为了解决expo start的下载app过慢问题。

访问下载链接：`https://dpq5q02fu5f55.cloudfront.net/Exponent-2.21.3.tar.gz`

其中`2.21.3`这个是可以变化的。

你可以先随便安装一个，然后再run start，可能会出现提示recommend的版本，再进行调整

```txt
✖ Expo Go 2.33.16 is recommended for SDK 53.0.0 (iPhone 16 Plus is using 2.25.1). Learn more: https://docs.expo.dev/get-started/expo-go/#sdk-versions. Install the recommended Expo Go version? … yes
```

下载好的tar.gz文件如何解压？

```shell
# 创建app文件夹（壳）
mkdir Exponent-2.33.16.app

# 解压gz包
tar -xvf Exponent-2.33.16.tar.gz -C Exponent-2.33.16.app

# 向模拟器中安装app
xcrun simctl install booted Exponent-2.33.16.app
```