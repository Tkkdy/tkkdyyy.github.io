$ErrorActionPreference = 'Stop'

$explorationRoot = $PSScriptRoot
$projectRoot = Split-Path (Split-Path $explorationRoot -Parent) -Parent
$localCanvasSource = Join-Path $explorationRoot 'gemini-canvas-source.html'
$runtimeCanvasSource = Join-Path $projectRoot '.playwright-mcp\vdvxdv-articles-visual-exploration.html'
$canvasSource = if (Test-Path -LiteralPath $localCanvasSource) { $localCanvasSource } else { $runtimeCanvasSource }
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath $canvasSource)) {
    throw "Gemini Canvas source was not found: $canvasSource"
}

$source = [System.IO.File]::ReadAllText($canvasSource, [System.Text.Encoding]::UTF8)
$styleMatch = [regex]::Match($source, '<style>(?<css>[\s\S]*?)</style>')
if (-not $styleMatch.Success) { throw 'Canvas CSS block was not found.' }
$css = $styleMatch.Groups['css'].Value

# Canvas used Google-hosted typefaces. The standalone package keeps the same
# serif / sans / mono roles while falling back to system fonts offline.
$css = $css.Replace("'Inter', -apple-system, sans-serif", "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif")
$css = $css.Replace("'Noto Serif SC', serif", "'Noto Serif SC', 'Songti SC', SimSun, serif")
$css = $css.Replace("'JetBrains Mono', monospace", "'JetBrains Mono', 'Cascadia Code', Consolas, monospace")
$css += @'

/* Standalone exploration package */
.view-container { display: block; }
.exploration-back {
    position: fixed;
    left: 24px;
    bottom: 24px;
    z-index: 190;
    padding: 8px 12px;
    border: 1px solid var(--c-border);
    background: rgba(255, 255, 255, .92);
    color: var(--c-text-muted);
    font: 500 11px/1 var(--font-mono);
    letter-spacing: .03em;
}
.hub { max-width: 1280px; margin: 0 auto; padding: 150px 40px 96px; }
.hub-kicker { color: var(--c-text-muted); font: 500 12px/1 var(--font-mono); text-transform: uppercase; letter-spacing: .12em; }
.hub h1 { max-width: 900px; margin-top: 22px; font: 500 clamp(42px, 6vw, 84px)/.98 var(--font-serif); letter-spacing: -.045em; }
.hub-intro { max-width: 720px; margin-top: 28px; color: var(--c-text-muted); font-size: 17px; }
.hub-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 72px; background: var(--c-border); border: 1px solid var(--c-border); }
.hub-card { display: flex; min-height: 380px; padding: 32px; background: var(--c-bg); flex-direction: column; }
.hub-card .label { color: var(--c-text-light); font: 500 11px/1 var(--font-mono); }
.hub-card h2 { margin-top: 36px; font: 500 32px/1.1 var(--font-serif); }
.hub-card p { margin-top: 18px; color: var(--c-text-muted); }
.hub-links { display: flex; gap: 10px; margin-top: auto; padding-top: 32px; }
.hub-links a { padding: 10px 13px; border: 1px solid var(--c-border-dark); font: 500 11px/1 var(--font-mono); }
.hub-links a:first-child { color: var(--c-white); background: var(--c-text-main); }
.hub-note { margin-top: 32px; color: var(--c-text-light); font: 400 11px/1.6 var(--font-mono); }
@media (max-width: 768px) {
    .exploration-back { position: static; display: inline-block; margin: 18px 20px 0; }
    .hub { padding: 110px 20px 64px; }
    .hub-grid { grid-template-columns: 1fr; margin-top: 48px; }
    .hub-card { min-height: 300px; }
}
'@

[System.IO.File]::WriteAllText((Join-Path $explorationRoot 'styles.css'), $css.Trim() + "`n", $utf8)
[System.IO.File]::WriteAllText((Join-Path $explorationRoot 'gemini-canvas-source.html'), $source, $utf8)

$nav = @'
<nav class="glass-header" aria-label="主导航">
    <a href="#" class="brand">VDVXDV</a>
    <a href="#">项目</a><a href="#">随笔</a><a href="#" class="active">文章</a>
    <a href="#">碎片</a><a href="#">影像</a><a href="#">关于</a>
    <a href="#" style="margin-left:auto;">搜索</a>
</nav>
'@

$views = @(
    @{ Id = 'a-list'; Next = 'a-detail'; Folder = 'a-independent-editorial'; File = 'index.html'; Title = 'A — Modern Independent Publication'; Back = '../index.html' },
    @{ Id = 'a-detail'; Next = 'b-list'; Folder = 'a-independent-editorial'; File = 'article.html'; Title = 'A Detail — Modern Independent Publication'; Back = '../index.html' },
    @{ Id = 'b-list'; Next = 'b-detail'; Folder = 'b-personal-archive'; File = 'index.html'; Title = 'B — Rational Personal Archive'; Back = '../index.html' },
    @{ Id = 'b-detail'; Next = 'c-list'; Folder = 'b-personal-archive'; File = 'article.html'; Title = 'B Detail — Rational Personal Archive'; Back = '../index.html' },
    @{ Id = 'c-list'; Next = 'c-detail'; Folder = 'c-quiet-reading-room'; File = 'index.html'; Title = 'C — Quiet Reading Room'; Back = '../index.html' },
    @{ Id = 'c-detail'; Next = $null; Folder = 'c-quiet-reading-room'; File = 'article.html'; Title = 'C Detail — Quiet Reading Room'; Back = '../index.html' }
)

foreach ($view in $views) {
    $startToken = '<div id="view-' + $view.Id + '"'
    $start = $source.IndexOf($startToken, [System.StringComparison]::Ordinal)
    if ($start -lt 0) { throw "View not found: $($view.Id)" }
    if ($view.Next) {
        $endToken = '<div id="view-' + $view.Next + '"'
        $end = $source.IndexOf($endToken, $start + $startToken.Length, [System.StringComparison]::Ordinal)
    } else {
        $end = $source.IndexOf('<script>', $start, [System.StringComparison]::Ordinal)
    }
    if ($end -lt 0) { throw "End marker not found: $($view.Id)" }
    $fragment = $source.Substring($start, $end - $start).Trim()
    $fragment = [regex]::Replace($fragment, 'class="([^"]*)\bhidden\b([^"]*)"', { param($m) 'class="' + (($m.Groups[1].Value + $m.Groups[2].Value).Trim()) + '"' })
    $fragment = [regex]::Replace($fragment, '\s+onclick="switchView\(''[^'']+''\); return false;"', '')

    if ($view.Id -eq 'a-list') {
        $fragment = [regex]::Replace($fragment, '<a href="#" class="article-item"', '<a href="article.html" class="article-item"', 1)
    } elseif ($view.Id -eq 'b-list') {
        $fragment = [regex]::Replace($fragment, '<a href="#" class="archive-item"', '<a href="article.html" class="archive-item"', 1)
    } elseif ($view.Id -eq 'c-list') {
        $fragment = [regex]::Replace($fragment, '<a href="#">', '<a href="article.html">', 1)
    } else {
        $fragment = $fragment.Replace('href="#">← Back to Articles</a>', 'href="index.html">← Back to Articles</a>')
        $fragment = $fragment.Replace('href="#">[ Return to Index ]</a>', 'href="index.html">[ Return to Index ]</a>')
        $fragment = $fragment.Replace('href="#">Close Book</a>', 'href="index.html">Close Book</a>')
    }

    $page = @"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="VDVXDV Articles 视觉原型：$($view.Title)">
    <link rel="icon" href="data:,">
    <title>$($view.Title) · VDVXDV</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
$nav
<a class="exploration-back" href="$($view.Back)">← Comparison Hub</a>
$fragment
</body>
</html>
"@
    $dir = Join-Path $explorationRoot $view.Folder
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $dir $view.File), $page, $utf8)
}

$hub = @'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="VDVXDV Articles 三方向视觉原型比较入口">
    <link rel="icon" href="data:,">
    <title>Articles Visual Exploration · VDVXDV</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="glass-header" aria-label="主导航"><a href="#" class="brand">VDVXDV</a><a href="#" class="active">Articles Visual Exploration</a></nav>
<main class="hub">
    <p class="hub-kicker">Comparison Hub / Non-production</p>
    <h1>Articles, three ways of remembering.</h1>
    <p class="hub-intro">同一份真实内容夹具，被放进三种完全不同的阅读秩序：出版物、个人档案与安静阅览室。这里仅用于比较，不代表最终生产方案。</p>
    <section class="hub-grid" aria-label="三个视觉方向">
        <article class="hub-card"><span class="label">DIRECTION A / EDITORIAL</span><h2>现代独立出版物</h2><p>大尺度编辑网格、编号与元数据侧栏；强调一期一期“出版”的节奏。</p><div class="hub-links"><a href="a-independent-editorial/index.html">列表页</a><a href="a-independent-editorial/article.html">详情页</a></div></article>
        <article class="hub-card"><span class="label">DIRECTION B / ARCHIVE</span><h2>理性个人档案</h2><p>索引、年份、字段与紧凑表格；强调可检索、可追溯的个人知识库。</p><div class="hub-links"><a href="b-personal-archive/index.html">列表页</a><a href="b-personal-archive/article.html">详情页</a></div></article>
        <article class="hub-card"><span class="label">DIRECTION C / READING</span><h2>安静阅读空间</h2><p>窄栏、留白、衬线正文与弱化元数据；强调连续阅读和精神停留。</p><div class="hub-links"><a href="c-quiet-reading-room/index.html">列表页</a><a href="c-quiet-reading-room/article.html">详情页</a></div></article>
    </section>
    <p class="hub-note">Gemini 3.1 Pro · Extended Thinking · Canvas / 2026-08-09<br>Fixture-based static prototype. No Astro migration, no production source changes.</p>
</main>
</body>
</html>
'@
[System.IO.File]::WriteAllText((Join-Path $explorationRoot 'index.html'), $hub, $utf8)
Write-Output "Materialized Articles exploration at $explorationRoot"
