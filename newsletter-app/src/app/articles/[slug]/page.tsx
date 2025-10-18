import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

interface ArticlePageProps {
  params: { slug: string }
}

const articlesDirectory = path.join(process.cwd(), 'public/articles')

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const slug = params.slug
  
  try {
    const filePath = path.join(articlesDirectory, `${slug}.md`)
    
    if (!fs.existsSync(filePath)) {
      return {
        title: 'Article Not Found | Talyon',
        description: 'The requested article could not be found.'
      }
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)
    
    const title = data.title ? `${data.title} | Talyon` : `${slug.replace(/-/g, ' ')} | Talyon`
    const description = data.description || data.excerpt || 'Read more about tech careers in Singapore.'

    return {
      title,
      description,
      alternates: { canonical: `https://talyon.asia/articles/${slug}` },
      openGraph: {
        title,
        description,
        url: `https://talyon.asia/articles/${slug}`,
      },
    }
  } catch (error) {
    return {
      title: 'Article Not Found | Talyon',
      description: 'The requested article could not be found.'
    }
  }
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const slug = params.slug
  
  try {
    const filePath = path.join(articlesDirectory, `${slug}.md`)
    
    if (!fs.existsSync(filePath)) {
      notFound()
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    
    const article = {
      title: data.title || slug.replace(/-/g, ' '),
      date: data.date || new Date().toISOString().split('T')[0],
      content: content
    }

    return (
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <nav className="mb-8">
            <a href="/articles" className="text-gray-600 hover:text-black">
              ← Back to Articles
            </a>
          </nav>

          <article className="prose prose-lg max-w-none">
            <header className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">
                {article.title}
              </h1>
              <div className="text-gray-600">
                Published on {article.date}
              </div>
            </header>

            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: article.content
                  .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                  .replace(/^\- (.*$)/gim, '<li>$1</li>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
                  .replace(/\n/g, '<br>')
              }}
            />
          </article>

          <div className="mt-12 p-6 bg-gray-50 border border-gray-200">
            <h3 className="text-xl font-semibold text-black mb-3">Ready to Take Action?</h3>
            <p className="text-gray-600 mb-4">
              Apply these insights to your job search with personalized recommendations.
            </p>
            <a 
              href="/" 
              className="inline-block bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors"
            >
              Upload Resume for AI-Powered Job Matching
            </a>
          </div>
        </div>
      </main>
    )
  } catch (error) {
    notFound()
  }
}
