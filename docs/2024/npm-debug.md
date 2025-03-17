# npm 发布包调试

## 安装新包后项目 node_modules 丢失了 css-loader

发布新包后，在项目里安装了新包用于测试，发现本地启动项目，发现 node_modules 丢失了 css-loader，导致项目启动报错。而原来的包不会导致这个问题，于是使用命令查看依赖关系。

```bash
npm ls css-loader
```

经过对比，发现旧包会触发安装 css-loader，新包不会，这说明应该是新包发布的时候出了什么问题导致 css-loader 没有被安装。
