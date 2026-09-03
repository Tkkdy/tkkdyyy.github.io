import React, { useState, useEffect } from 'react';

// 注入设计系统的 CSS 变量和全局样式
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap');

    :root {
      --color-canvas: #F3F0E8;
      --color-canvas-soft: #F7F5EF;
      --color-surface: #FCFBF7;
      --color-surface-strong: #E9E3D8;

      --color-ink: #191918;
      --color-ink-soft: #46443F;
      --color-ink-muted: #77736B;
      --color-ink-inverse: #F6F3EC;

      --color-border: rgba(25, 25, 24, 0.14);
      --color-border-strong: rgba(25, 25, 24, 0.28);

      --color-accent: #5D6B58; /* 低饱和度强调色 (绿) */

      --font-interface: 'Inter', -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      --font-editorial: 'Noto Serif SC', "Source Han Serif SC", SimSun, serif;
      --font-code: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      
      --page-max-width: 1440px;
    }

    body {
      background-color: var(--color-canvas);
      color: var(--color-ink);
      font-family: var(--font-interface);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.6;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-interface);
    }
    
    .font-serif {
      font-family: var(--font-editorial) !important;
    }

    .font-mono {
      font-family: var(--font-code) !important;
    }

    .glass-nav {
      background: rgba(243, 240, 232, 0.72);
      backdrop-filter: blur(16px) saturate(120%);
      border-bottom: 1px solid var(--color-border);
    }

    /* 优雅的链接下划线过渡 */
    .link-underline {
      text-decoration: underline;
      text-decoration-color: transparent;
      text-underline-offset: 4px;
      transition: text-decoration-color 0.2s ease;
    }
    .link-underline:hover {
      text-decoration-color: var(--color-ink-muted);
    }
  `}} />
);

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navItems = ['项目', '随笔', '文章', '碎片', '影像', '关于', '搜索'];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-[1440px] mx-auto px-5 md:px-12 lg:px-16 h-16 flex items-center justify-between">
        <a href="#" className="text-xl font-bold tracking-widest text-[var(--color-ink)] shrink-0">
          VDVXDV
        </a>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center gap-8 text-[0.875rem] font-medium text-[var(--color-ink-soft)]">
          {navItems.map((item, idx) => (
            <a key={idx} href={`#${item}`} className="hover:text-[var(--color-ink)] transition-colors">
              {item}
            </a>
          ))}
        </nav>

        {/* 移动端菜单按钮 */}
        <button 
          className="md:hidden p-2 -mr-2 text-[var(--color-ink)]"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8h16M4 16h16" />
            </svg>
          )}
        </button>
      </div>

      {/* 移动端下拉菜单 */}
      {isOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[var(--color-canvas)] border-b border-[var(--color-border)] shadow-sm">
          <nav className="flex flex-col py-4 px-5">
            {navItems.map((item, idx) => (
              <a key={idx} href={`#${item}`} className="py-3 text-[1rem] border-b border-[var(--color-border)] last:border-0 hover:text-[var(--color-ink-soft)]">
                {item}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

const HeroSection = () => {
  return (
    <section className="pt-32 pb-16 md:pt-48 md:pb-24 px-5 md:px-12 lg:px-16 max-w-[1440px] mx-auto">
      <div className="max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-[var(--color-ink)] mb-8">
          VDVXDV
        </h1>
        <p className="font-serif text-xl md:text-2xl text-[var(--color-ink-soft)] leading-[1.7] mb-12">
          技术、创造、影像，<br className="hidden md:block"/>以及一些持续形成中的想法。
        </p>
        <div className="flex flex-wrap gap-4">
          <a href="#项目" className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-ink)] text-[var(--color-ink-inverse)] font-medium rounded-full text-sm hover:bg-[var(--color-ink-soft)] transition-colors">
            查看项目
          </a>
          <a href="#文章" className="inline-flex items-center justify-center px-6 py-3 border border-[var(--color-border-strong)] text-[var(--color-ink)] font-medium rounded-full text-sm hover:bg-[var(--color-surface)] transition-colors">
            阅读文章
          </a>
        </div>
      </div>
    </section>
  );
};

const FeaturedSection = () => {
  return (
    <section className="px-5 md:px-12 lg:px-16 max-w-[1440px] mx-auto mb-32">
      {/* 采用 Anthropic Research 式的顶部细线和非对称网格 */}
      <div className="border-t border-[var(--color-border-strong)] pt-8">
        <h2 className="text-xs font-mono text-[var(--color-ink-muted)] uppercase tracking-widest mb-8">
          Featured / 精选
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* 左侧主要区域：代表文章 (占据 7 列) - 视觉优先 */}
          <div className="lg:col-span-7 group cursor-pointer">
            <div className="aspect-[16/9] w-full bg-[var(--color-surface-strong)] rounded-lg overflow-hidden mb-6">
              <img 
                src="https://placehold.co/800x450/E9E3D8/77736B?text=Abstract+Information+Layer" 
                alt="抽象的信息层与个人空间" 
                className="w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono text-[var(--color-ink-muted)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">Article</span>
              <span className="text-xs text-[var(--color-ink-muted)] font-mono">2026-08-05</span>
            </div>
            <h3 className="font-serif text-2xl md:text-3xl text-[var(--color-ink)] leading-snug mb-4 group-hover:text-[var(--color-accent)] transition-colors">
              上下文正在成为个人 AI 的真正界面
            </h3>
            <p className="text-[var(--color-ink-soft)] leading-[1.7] text-sm md:text-base md:pr-12">
              当 AI 长期理解一个人的项目、文件、偏好和决定，它才开始从聊天工具变成真正的能力延伸。
            </p>
          </div>

          {/* 右侧辅助区域：重点项目 (占据 5 列) - 操作优先，Aesop 式色块感 */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-[var(--color-surface)] p-6 md:p-8 rounded-xl border border-[var(--color-border)] hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start mb-12">
                <span className="text-xs font-mono text-[var(--color-ink-muted)]">Project</span>
                <span className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-ink-soft)] bg-[var(--color-canvas)] px-2.5 py-1 rounded-full border border-[var(--color-border)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 开发中
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-[var(--color-ink)] mb-3">
                Morning Radar
              </h3>
              <p className="text-[var(--color-ink-soft)] leading-relaxed mb-8 text-sm">
                一个自动收集、筛选和整理过去二十四小时重要信息的个人晨报系统。为个人筛选每天真正值得关注的变化。
              </p>
              <a href="#" className="inline-flex items-center text-sm font-medium text-[var(--color-ink)] link-underline">
                查看项目详情 
                <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </a>
            </div>

            {/* 随笔/碎片极简列表 */}
            <div className="pt-6 border-t border-[var(--color-border)]">
              <span className="text-xs font-mono text-[var(--color-ink-muted)] block mb-4">Fragment / 碎片</span>
              <p className="text-[var(--color-ink-soft)] leading-relaxed text-sm">
                “模型会更新，工具会消失，但一个人积累过的上下文和判断仍然可以继续复用。”
              </p>
              <span className="block mt-3 text-xs font-mono text-[var(--color-ink-muted)]">2026-08-01</span>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};

const ProjectsSection = () => {
  const projects = [
    {
      name: "Personal Website",
      desc: "一个长期生长的个人互联网空间，承载文章、影像与个人创造。",
      status: "设计中",
      statusColor: "bg-blue-500",
      tech: ["Astro", "Tailwind", "MDX"]
    },
    {
      name: "Desktop Pet",
      desc: "一个具有陪伴感的桌面宠物项目，探索脱离标准窗口的交互体验。",
      status: "开发中",
      statusColor: "bg-amber-500",
      tech: ["Rust", "Tauri", "React"]
    }
  ];

  return (
    <section className="bg-[var(--color-surface-strong)] py-24 px-5 md:px-12 lg:px-16">
      <div className="max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-[var(--color-ink)] mb-4">创造</h2>
            <p className="text-[var(--color-ink-soft)]">正在探索和维护的公开项目。</p>
          </div>
          <a href="#" className="text-sm font-medium text-[var(--color-ink)] link-underline">
            浏览全部项目
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {projects.map((proj, idx) => (
            <div key={idx} className="bg-[var(--color-surface)] p-8 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors group cursor-pointer">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-[var(--color-ink)]">{proj.name}</h3>
                <span className="flex items-center gap-1.5 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-ink-soft)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                  <span className={`w-1.5 h-1.5 rounded-full ${proj.statusColor}`}></span> {proj.status}
                </span>
              </div>
              <p className="text-[var(--color-ink-soft)] leading-relaxed mb-10 text-sm">
                {proj.desc}
              </p>
              <div className="flex justify-between items-end border-t border-[var(--color-border)] pt-6 mt-auto">
                <div className="flex gap-3">
                  {proj.tech.map((t, i) => (
                    <span key={i} className="text-xs font-mono text-[var(--color-ink-muted)]">{t}</span>
                  ))}
                </div>
                <span className="text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)] transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const EssaysAndImagesSection = () => {
  return (
    <section className="py-32 px-5 md:px-12 lg:px-16 max-w-[1440px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* 左侧：随笔 */}
        <div>
          <h2 className="text-xs font-mono text-[var(--color-ink-muted)] uppercase tracking-widest mb-10 border-b border-[var(--color-border-strong)] pb-4">
            Essays / 随笔
          </h2>
          
          <div className="group cursor-pointer">
            <div className="aspect-[4/3] w-full md:w-3/4 bg-[var(--color-canvas-soft)] mb-6 overflow-hidden">
              <img 
                src="https://placehold.co/600x450/F7F5EF/77736B?text=Old+Computer+Screen" 
                alt="昏暗房间里的旧电脑屏幕" 
                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
              />
            </div>
            <h3 className="font-serif text-xl md:text-2xl text-[var(--color-ink)] mb-4">
              初中时，我只是想看 YouTube
            </h3>
            <p className="text-[var(--color-ink-soft)] text-sm leading-[1.8] mb-4">
              最初只是为了看游戏实况，后来却莫名其妙地搭起了属于自己的整个互联网世界。
            </p>
            <span className="text-xs font-mono text-[var(--color-ink-muted)]">2026-08-01</span>
          </div>
        </div>

        {/* 右侧：影像 (保持比例，不过度裁切) */}
        <div>
          <div className="flex justify-between items-end mb-10 border-b border-[var(--color-border-strong)] pb-4">
            <h2 className="text-xs font-mono text-[var(--color-ink-muted)] uppercase tracking-widest">
              Photography / 影像
            </h2>
            <a href="#" className="text-xs font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors">
              VIEW ALL
            </a>
          </div>

          <div className="flex flex-col gap-12">
            <div className="group">
               {/* 这里使用竖图比例示例 */}
              <div className="bg-[var(--color-surface-strong)] w-full sm:w-2/3 ml-auto aspect-[3/4]">
                 <img 
                  src="https://placehold.co/600x800/E9E3D8/77736B?text=Light+Before+Rain" 
                  alt="雨落下来以前" 
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="w-full sm:w-2/3 ml-auto mt-3 flex justify-between text-xs text-[var(--color-ink-muted)] font-mono">
                <span>雨落下来以前</span>
                <span>汕头</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="border-t border-[var(--color-border-strong)] bg-[var(--color-surface)] py-16 px-5 md:px-12 lg:px-16">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
        
        <div className="md:col-span-2">
          <div className="text-xl font-bold tracking-widest text-[var(--color-ink)] mb-4">
            VDVXDV
          </div>
          <p className="text-[var(--color-ink-soft)] text-sm max-w-sm leading-relaxed mb-8">
            这是一个属于技术创作者的个人空间。记录正在创造的项目、写下的观点，以及拍摄的影像。
          </p>
          <div className="flex gap-4">
            {/* 图标用极简文字占位，实际开发可换 SVG */}
            <a href="#" className="text-sm font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">GitHub</a>
            <a href="#" className="text-sm font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Email</a>
            <a href="#" className="text-sm font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">RSS</a>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-[var(--color-ink)] mb-4 uppercase tracking-wider">目录</h4>
          <ul className="flex flex-col gap-3">
            {['项目', '随笔', '文章', '碎片', '影像'].map((item, i) => (
              <li key={i}>
                <a href={`#${item}`} className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-[var(--color-ink)] mb-4 uppercase tracking-wider">其他</h4>
          <ul className="flex flex-col gap-3">
            <li>
              <a href="#关于" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors">
                关于
              </a>
            </li>
            <li>
              <a href="#搜索" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors">
                搜索
              </a>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalStyles />
      <Navigation />
      
      <main className="flex-1">
        <HeroSection />
        <FeaturedSection />
        <ProjectsSection />
        <EssaysAndImagesSection />
      </main>

      <Footer />
    </div>
  );
}