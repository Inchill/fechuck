// 书签数据加载：给每个网站补上域名和本地图标路径（图标文件不存在时前端显示首字母）
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import groups, { featured } from './links.mts'

const ICON_DIR = fileURLToPath(new URL('../public/bookmarks/icons/', import.meta.url))

export interface SiteItem {
  title: string
  url: string
  note: string
  host: string
  icon: string
}
export interface GroupItem {
  name: string
  desc: string
  sites: SiteItem[]
}

export interface FeaturedItem extends SiteItem {
  label: string
}
export interface BookmarksData {
  groups: GroupItem[]
  featured: FeaturedItem[]
}

declare const data: BookmarksData
export { data }

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

export default {
  watch: ['./links.mts', '../public/bookmarks/icons/*'],
  load(): BookmarksData {
    const icons = new Map<string, string>()
    if (existsSync(ICON_DIR)) for (const f of readdirSync(ICON_DIR)) icons.set(f.replace(/\.[^.]+$/, ''), f)
    const list = groups.map((g) => ({
      name: g.name,
      desc: g.desc ?? '',
      sites: g.sites.map((s) => {
        const host = hostOf(s.url)
        const icon = icons.get(host)
        return { title: s.title, url: s.url, note: s.note ?? '', host, icon: icon ? `/bookmarks/icons/${icon}` : '' }
      })
    }))
    const all = list.flatMap((g) => g.sites)
    const picks = (featured ?? [])
      .map((f) => {
        const site = all.find((s) => s.url === f.url)
        return site ? { ...site, label: f.label } : null
      })
      .filter((x): x is FeaturedItem => !!x)
    return { groups: list, featured: picks }
  }
}
