# 店铺日账（新网站）

跟 dianpu-rizhang 一样：需要登录、多人数据互通；完全独立的新账本，数据互不干扰。
功能：每日记账（现金/刷卡/备注）、去年今日对比、每月总结（含环比/同比、柱状图、每日明细）、店铺成员与邀请码管理。

## 文件说明

- `index.html` —— 页面结构
- `styles.css` —— 样式
- `app.js` —— 主逻辑
- `db.js` —— Firebase 数据层（数据模型与 dianpu-rizhang 完全一致）
- `firebase.js` —— Firebase SDK（CDN 引入，无需安装）
- `config.js` —— **需要你填写** Firebase 配置

## 部署步骤（GitHub Pages）

1. **填配置**：打开 `config.js`，把 Firebase 配置填进去。
   最省事的办法：直接把 dianpu-rizhang 网站的 `config.js` 内容复制过来
   （用同一个 Firebase 项目就行，数据完全独立，互不干扰）。
2. **建仓库**：在 GitHub 新建一个公开仓库（比如 `dianpu-rizhang-2`），把这 6 个文件传上去。
3. **开 Pages**：仓库 → Settings → Pages → Source 选 `main` 分支 → 保存。
   部署好后会得到一个网址，比如 `https://你的用户名.github.io/dianpu-rizhang-2/`。
4. **加授权域名**：去 Firebase 控制台 → Authentication → Settings → Authorized domains，
   把第 3 步的域名（比如 `你的用户名.github.io`）加进去，否则 Google 登录会报错。
5. **数据库规则**：如果用的是同一个 Firebase 项目，dianpu-rizhang 的 Firestore
   规则直接复用，不用改（数据模型完全一样）。如果是全新的 Firebase 项目，
   把旧项目的 Firestore Rules 复制一份过去即可。

## 使用

1. 打开网站，用邮箱注册或 Google 登录。
2. 「创建店铺」填店铺名和你的名字 → 得到 6 位邀请码。
3. 把邀请码发给店员，对方登录后选「用邀请码加入」。
4. 记账页选日期填现金/刷卡/备注 → 保存，所有成员实时同步。

## 说明

- 离线也能打开看已缓存的数据，联网后自动同步。
- 每条保存/删除都会留操作记录，方便对账。
- 店主可以在「店铺」页换邀请码、移出成员。
