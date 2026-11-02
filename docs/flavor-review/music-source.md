# 音源记录

`media/music/angelika-vee-you-are-my-sunshine.mp3` 来自 Owner 本轮附上的同名 MP3，Owner 明确表示“所提供音频已购买 可以使用”。没有抓取或下载第三方录音/封面。Artist 按提供文件名，不另行指定录音版本。

CI 发现现有静态发布包白名单不接受 MP3。本轮保留保护，不修改发布配置/白名单：音频素材存放在仓库 media/ 中，卡片使用已推送 `b2fcd540fc8db229b0839a28c43a56e76e03410a` 中同字节文件的固定 HTTPS Raw URL。该 URL 是本轮授权素材自己的不可变 Git 版本，非第三方商业音源。构建产物不携带 MP3。将来可以改成 Owner 确认的合法平台链接。

只在关于页点击播放，preload=none；源失效显示不可播放。新增的限制是依赖 GitHub Raw 可用性/网络；本轮有实际 HTTPS 字节哈希和真实 Chromium 点击播放验收。未部署到正式站。停止播放能力可清空 music.source，退回纯文字卡。
