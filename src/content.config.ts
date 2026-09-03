// VDVXDV 内容模型 — Astro Content Collections 定义
//
// 依据：CONTENT_MODEL.md（Source of Truth）。
// 五种内容类型保持独立：articles / essays / fragments / projects / images。
// 不创建万能 Schema，不引入第三方库（使用 Astro 自带 defineCollection + zod）。

import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// ---- 共用字段 ----

/** 内容发布状态（CONTENT_MODEL §3.2） */
const statusSchema = z.enum(['draft', 'published', 'archived']);

/** 首页策展设置（CONTENT_MODEL §9）：show 是否上首页，order 仅控制同类型内部顺序 */
const homepageSchema = z.object({
  show: z.boolean(),
  order: z.number().int().positive().optional(),
});

/** 有 cover / image 时必须同时提供说明文字（CONTENT_MODEL §4.2 / §6.2） */
function requireAltForMedia(
  data: { cover?: string; coverAlt?: string },
  ctx: z.RefinementCtx,
) {
  if (data.cover && !data.coverAlt) {
    ctx.addIssue({
      code: 'custom',
      message: '有 cover 时必须填写 coverAlt（图片说明）',
    });
  }
}

// ---- articles 文章（CONTENT_MODEL §4） ----

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      status: statusSchema,
      publishNumber: z.number().int().positive().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      cover: z.string().optional(),
      coverAlt: z.string().optional(),
      featured: z.boolean().optional(),
      homepage: homepageSchema.optional(),
      toc: z.boolean().optional(),
      readingTime: z.number().optional(),
    })
    .superRefine((data, ctx) => {
      requireAltForMedia(data, ctx);

      if (data.status !== 'draft' && data.publishNumber === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['publishNumber'],
          message: 'Published and archived articles require a stable publishNumber',
        });
      }
    }),
});

// ---- essays 随笔（CONTENT_MODEL §5） ----
// 适配说明：CONTENT_MODEL 的 essay 字段未定义"首页摘要"；
// 为保持 v0.2.6 首页随笔卡片的摘要文案与 DOM 不变，增加可选 summary 字段（不影响其他字段）。

const essays = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essays' }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string(),
      summary: z.string().optional(),
      publishedAt: z.coerce.date(),
      status: statusSchema,
      tags: z.array(z.string()).optional(),
      cover: z.string().optional(),
      coverAlt: z.string().optional(),
      readingTime: z.number().optional(),
      featured: z.boolean().optional(),
      homepage: homepageSchema.optional(),
    })
    .superRefine(requireAltForMedia),
});

// ---- fragments 碎片（CONTENT_MODEL §6） ----
// 碎片不需要标题；正文即内容（body 必填）。

const fragments = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/fragments' }),
  schema: z
    .object({
      slug: z.string(),
      publishedAt: z.coerce.date(),
      status: statusSchema,
      tags: z.array(z.string()).optional(),
      image: z.string().optional(),
      imageAlt: z.string().optional(),
      link: z.url().optional(),
      linkTitle: z.string().optional(),
      homepage: homepageSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (data.image && !data.imageAlt) {
        ctx.addIssue({
          code: 'custom',
          message: '有 image 时必须填写 imageAlt（图片说明）',
        });
      }
    }),
});

// ---- projects 项目（CONTENT_MODEL §7） ----

/** 项目生命周期状态（CONTENT_MODEL §7.2）——与内容发布状态 status 相互独立 */
const projectStatusSchema = z.enum([
  'concept',
  'designing',
  'developing',
  'usable',
  'maintaining',
  'paused',
  'completed',
  'archived',
]);

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z
    .object({
      name: z.string(),
      slug: z.string(),
      tagline: z.string(),
      description: z.string(),
      // 内容发布状态：与所有内容类型统一（draft / published / archived）
      status: statusSchema,
      // 项目生命周期状态：与发布状态独立
      projectStatus: projectStatusSchema,
      // 对生命周期的事实补充，例如“可在本地使用 / 部署待完成”。
      statusNote: z.string().optional(),
      // 可验证的项目特点或结果；只保存内容，不保存展示坐标。
      highlights: z.array(z.string()).optional(),
      cover: z.string().optional(),
      coverAlt: z.string().optional(),
      logo: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      liveUrl: z.url().optional(),
      githubUrl: z.url().optional(),
      startedAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      featured: z.boolean().optional(),
      homepage: homepageSchema.optional(),
      screenshots: z
        .array(
          z.object({
            src: z.string(),
            alt: z.string(),
            caption: z.string().optional(),
          }),
        )
        .optional(),
      changelog: z
        .array(
          z.object({
            version: z.string(),
            date: z.coerce.date(),
            summary: z.string(),
          }),
        )
        .optional(),
    })
    .superRefine(requireAltForMedia),
});

// ---- images 影像（CONTENT_MODEL §8） ----
// 单张照片为最小内容单位；alt 必填。

const images = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/images' }),
  schema: z.object({
    slug: z.string(),
    image: z.string(),
    alt: z.string(),
    title: z.string().optional(),
    caption: z.string().optional(),
    capturedAt: z.coerce.date().optional(),
    publishedAt: z.coerce.date(),
    location: z.string().optional(),
    tags: z.array(z.string()).optional(),
    series: z.string().optional(),
    /** 展示比例提示：真实文件仍按原比例渲染，不裁切。 */
    orientation: z.enum(['landscape', 'portrait', 'square']).optional(),
    featured: z.boolean().optional(),
    homepage: homepageSchema.optional(),
    status: statusSchema,
  }),
});

export const collections = {
  articles,
  essays,
  fragments,
  projects,
  images,
};
