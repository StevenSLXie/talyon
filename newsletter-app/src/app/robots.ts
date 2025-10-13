import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/profile', '/app', '/api/private'],
      },
    ],
    sitemap: 'https://talyon.asia/sitemap.xml',
  }
}


