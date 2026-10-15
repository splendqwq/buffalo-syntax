# 试玩网页：让托管平台承担流量

句子生成、草稿解析、SVG 绘图与音频播放均在访客浏览器中完成。将网站文件部署到静态托管平台，由平台提供访问服务。

## 最省操作：Cloudflare Pages 拖拽上传

1. 在项目目录执行 `npm run build`（Windows PowerShell 可用 `npm.cmd run build`）。生成的 `dist/` 是网站发布目录。
2. 用 `npm run preview` 在本机试一遍。确认生成、图编辑、选择自己的音乐和 Q 弹正常。
3. 登录 Cloudflare，在 **Workers & Pages** 新建 Pages 项目，选择 **Direct Upload / 上传资产**。
4. 把 **dist 文件夹本身** 拖进去，确认网站根目录能直接看到 `index.html`。也可上传包含 dist 内部文件的 ZIP，避免再套一层目录。
5. 部署后使用平台提供的 `*.pages.dev` 地址，也可随后配置自定义域名。

访客直接从 Pages 获取网站资源。根据目前的 [Pages 计费说明](https://developers.cloudflare.com/pages/functions/pricing/)，普通静态资源请求免费且不限量；[产品页](https://www.cloudflare.com/developer-platform/products/pages/) 列出不限带宽。发布前可核对 [平台限制](https://developers.cloudflare.com/pages/platform/limits/) 中的文件与构建限制。

Direct Upload 项目改用 Git 集成时，需要创建新的 Pages 项目。希望每次提交后自动更新网站，可以在创建时选择下面的 Git 集成。详见 [官方 Direct Upload 文档](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

## 开源仓库自动更新：Cloudflare Pages Git 集成

如果源码已在 GitHub 或 GitLab，创建 Pages 项目时选择仓库并设置：

| 设置 | 值 |
| --- | --- |
| 框架 | 无 / None |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js | 20 或更新版本 |

选择需要自动部署的分支，Pages 会在提交后运行构建命令并发布 `dist/`。

## 另一种选择：GitHub Pages

如果希望源码和试玩站都放在 GitHub，也可用 GitHub Pages 发布 `dist/` 内容。项目所有网页资源路径都相对于页面，因此支持 `https://用户名.github.io/仓库名/` 这种路径。

它适合小型开源试玩站，不过目前 [GitHub 官方限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) 有 **每月 100 GB 的软带宽上限**、站点最大 1 GB 等限制。使用 Pages 的部署产物机制或发布分支时，把 `dist/` 内容放在站点根目录即可。

## 部署文件

- 上传 `dist/`，其中包含页面、脚本、样式、图标和许可声明。
- `server.mjs` 用于本机开发和预览，监听 `127.0.0.1`。
- 页面会请求 Google Fonts；不可用时使用系统字体。若要自行托管字体，请同时保留其许可证，参见 [NOTICE](../NOTICE.md)。

发布后，用试玩地址检查资源加载情况和访问速度。
