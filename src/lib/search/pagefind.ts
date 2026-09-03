// VDVXDV 共享 Pagefind 加载与搜索（客户端模块）
//
// 仅被客户端 <script> import（search 页与顶部导航 Search Mode 共用），
// 不作为服务端模块使用。职责只有两个：loadPagefind() / search()。
//
// 注意（已修复过的两个真实 Bug，不要重新引入）：
// 1. 不要用 `import(变量)` 直接写动态 import——Astro 7 内联 script 存在
//    __VITE_PRELOAD__ 占位符问题；这里用 new Function 构造原生 import 绕过。
// 2. Pagefind 1.5.2 bundle 的 module namespace 本身就是 API 对象
//    （顶层导出 search / init 等），没有名为 pagefind 的导出；
//    不要取 module.pagefind（那会是 undefined）。

// Pagefind 为运行时动态模块，无静态类型；保持最小 any 并限定使用面。
let pagefindModulePromise: Promise<any> | null = null;

const base = import.meta.env.BASE_URL;

/** 加载 Pagefind 模块（Promise 缓存，只加载一次；返回值就是模块自身） */
export function loadPagefind(): Promise<any> {
  if (!pagefindModulePromise) {
    const url = `${base}pagefind/pagefind.js`;
    pagefindModulePromise = new Function('url', 'return import(url)')(url).then(
      (mod: any) => mod,
    );
  }
  // 上方 if 已保证赋值过；TS 无法对闭包变量收窄，这里显式断言
  return pagefindModulePromise as Promise<any>;
}

/** 执行 Pagefind 搜索；模块非法时抛 TypeError（不吞异常） */
export async function search(query: string): Promise<any> {
  const pagefind = await loadPagefind();
  if (!pagefind || typeof pagefind.search !== 'function') {
    throw new TypeError(`Pagefind module invalid: ${typeof pagefind}`);
  }
  return pagefind.search(query);
}
