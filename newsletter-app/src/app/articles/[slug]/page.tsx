import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

interface ArticlePageProps {
  params: { slug: string }
}

const articlesDirectory = path.join(process.cwd(), 'public/articles')

export async function generateStaticParams() {
  try {
    const files = fs.readdirSync(articlesDirectory)
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        slug: file.replace('.md', ''),
      }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

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

export default async function ArticlePage({ params }: ArticlePageProps) {
  const slug = params.slug
  
  try {
    const filePath = path.join(articlesDirectory, `${slug}.md`)
    
    if (!fs.existsSync(filePath)) {
      notFound()
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    
    // Process markdown content
    const processedContent = await remark()
      .use(html)
      .process(content)
    const contentHtml = processedContent.toString()
    
    const article = {
      title: data.title || slug.replace(/-/g, ' '),
      date: data.date || new Date().toISOString().split('T')[0],
      content: contentHtml
    }

    return (
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <nav className="mb-8">
            <a href="/articles" className="text-gray-600 hover:text-black">
              ← Back to Insights
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
              className="prose prose-lg max-w-none prose-headings:text-black prose-p:text-gray-700 prose-strong:text-black prose-table:text-sm"
              dangerouslySetInnerHTML={{ __html: article.content }}
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
