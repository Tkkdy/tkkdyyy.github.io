// VDVXDV 项目查询层（列表页、详情页、首页共用）
//
// 职责：
// - 只返回 status = published 的项目（draft 不公开、archived 暂不进主列表）；
// - 稳定排序：featured 优先 → updatedAt 从新到旧；
// - 提供项目生命周期状态显示文案（供列表页 / 详情页 / 首页复用）。
//
// 注意双状态语义（Stage 2 已确认）：
// - status       = 内容发布状态（draft / published / archived），决定是否公开；
// - projectStatus = 项目生命周期状态（developing 等），决定页面显示文案。

import { getCollection, type CollectionEntry } from 'astro:content';

/** 项目生命周期状态显示文案（CONTENT_MODEL §7.2 中文显示 + 原型英文前缀风格） */
export const PROJECT_STATUS_LABELS: Record<
  CollectionEntry<'projects'>['data']['projectStatus'],
  string
> = {
  concept: 'Concept · 构思中',
  designing: 'Designing · 设计中',
  developing: 'Developing · 开发中',
  usable: 'Usable · 可使用',
  maintaining: 'Maintaining · 维护中',
  paused: 'Paused · 暂停',
  completed: 'Completed · 已完成',
  archived: 'Archived · 已归档',
};

/** 公开项目列表：status = published；排序 featured 优先 → 有日期者按 updatedAt 倒序 → 名称。 */
export async function getPublishedProjects(): Promise<CollectionEntry<'projects'>[]> {
  const entries = await getCollection('projects');
  return entries
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => {
      const featuredA = a.data.featured ?? false;
      const featuredB = b.data.featured ?? false;
      if (featuredA !== featuredB) return Number(featuredB) - Number(featuredA);
      const updatedA = a.data.updatedAt?.getTime() ?? 0;
      const updatedB = b.data.updatedAt?.getTime() ?? 0;
      if (updatedA !== updatedB) return updatedB - updatedA;
      return a.data.name.localeCompare(b.data.name, 'en');
    });
}
