// 最小 Node fs 类型声明（构建期图片存在性检查用）。
//
// 不安装 @types/node：保持 Stage 3C 零新增依赖。
// 仅声明本项目实际用到的 API；未来如需更多 Node API 再补充。

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}
