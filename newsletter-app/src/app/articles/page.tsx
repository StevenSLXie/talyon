import type { Metadata } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export const metadata: Metadata = {
  title: 'Tech Career Insights & Analysis | Talyon',
  description: 'Expert insights on Singapore tech careers, salary guides, resume tips, and industry trends. Stay ahead in your tech career journey.',
  alternates: { canonical: 'https://talyon.asia/articles' },
  openGraph: {
    title: 'Tech Career Insights & Analysis | Talyon',
    description: 'Expert insights on Singapore tech careers, salary guides, and industry trends.',
    url: 'https://talyon.asia/articles',
  },
}

const articlesDirectory = path.join(process.cwd(), 'public/articles')

export default function ArticlesPage() {
  // Read all markdown files
  const files = fs.readdirSync(articlesDirectory)
  const articles = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace('.md', '')
      const filePath = path.join(articlesDirectory, file)
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { data, content } = matter(fileContents)
      
      return {
        slug,
        title: data.title || slug.replace(/-/g, ' '),
        date: data.date || new Date().toISOString().split('T')[0],
        excerpt: data.excerpt || content.substring(0, 200) + '...',
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-6">Tech Career Insights</h1>
        <p className="text-lg text-gray-600 mb-12">
          Expert insights on Singapore tech careers, salary guides, resume tips, and industry trends.
        </p>

        <div className="grid gap-8">
          {articles.map((article) => (
            <article key={article.slug} className="border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-2xl font-semibold text-black mb-3">
                <a href={`/articles/${article.slug}`} className="hover:text-gray-600">
                  {article.title}
                </a>
              </h2>
              <p className="text-gray-600 mb-4">
                {article.excerpt}
              </p>
              <div className="flex items-center text-sm text-gray-500">
                <span>{article.date}</span>
                <span className="mx-2">•</span>
                <span>5 min read</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 p-6 bg-gray-50 border border-gray-200">
          <h3 className="text-xl font-semibold text-black mb-3">Stay Updated</h3>
          <p className="text-gray-600 mb-4">
            Get the latest career insights and job market trends delivered to your inbox.
          </p>
          <a 
            href="/" 
            className="inline-block bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors"
          >
            Upload Resume for Personalized Insights
          </a>
        </div>
      </div>
    </main>
  )
}
