import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://talyon.asia'

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/insights`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/articles`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]

  // Article pages
  const articlePages: MetadataRoute.Sitemap = [
    { url: `${base}/articles/local-banks`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Singapore programmatic routes (role collections)
  const sgRoles = [
    'software-engineer',
    'frontend-engineer',
    'backend-engineer',
    'data-scientist',
    'ml-engineer',
    'product-manager',
  ]

  const sgRolePages: MetadataRoute.Sitemap = sgRoles.map((role) => ({
    url: `${base}/jobs/singapore/${role}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [...staticPages, ...articlePages, ...sgRolePages]
}


