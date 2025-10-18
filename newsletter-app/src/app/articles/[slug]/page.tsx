import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Navigation from '@/components/Navigation'

interface ArticlePageProps {
  params: { slug: string }
}

const articlesDirectory = path.join(process.cwd(), 'public/articles')

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-black mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold text-black mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-black mt-8 mb-6">$1</h1>')
    
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-black">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    
    // Lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4 mb-1">• $1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4 mb-1">$1. $2</li>')
    
    // Tables (improved support)
    .replace(/^\|(.+)\|$/gm, (match, content) => {
      const cells = content.split('|').map((cell: string) => cell.trim()).filter(cell => cell)
      if (cells.length === 0) return ''
      
      // Check if this is a header row (contains emojis or looks like headers)
      const isHeader = cells.some(cell => cell.includes('Dimension') || cell.includes('DBS') || cell.includes('UOB') || cell.includes('OCBC'))
      
      if (isHeader) {
        return `<tr>${cells.map((cell: string) => `<th class="border border-gray-300 px-3 py-2 text-sm font-semibold bg-gray-50">${cell}</th>`).join('')}</tr>`
      } else {
        return `<tr>${cells.map((cell: string) => `<td class="border border-gray-300 px-3 py-2 text-sm">${cell}</td>`).join('')}</tr>`
      }
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<table class="border-collapse border border-gray-300 w-full my-4">$1</table>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm">$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br>')
    
    // Wrap in paragraphs
    .replace(/^(?!<[h1-6]|<li|<tr|<pre|<code)(.*)$/gim, '<p class="mb-4 text-gray-700">$1</p>')
    
    // Clean up empty paragraphs and fix structure
    .replace(/<p class="mb-4 text-gray-700"><\/p>/g, '')
    .replace(/<p class="mb-4 text-gray-700">(<li|<tr|<pre|<h[1-6])/g, '$1')
    .replace(/(<\/li>|<\/tr>|<\/pre>|<\/h[1-6]>)<\/p>/g, '$1')
}

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

export default function ArticlePage({ params }: ArticlePageProps) {
  const slug = params.slug
  
  try {
    const filePath = path.join(articlesDirectory, `${slug}.md`)
    
    if (!fs.existsSync(filePath)) {
      notFound()
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    
    // Process markdown content
    const contentHtml = markdownToHtml(content)
    
    const article = {
      title: data.title || slug.replace(/-/g, ' '),
      date: data.date || new Date().toISOString().split('T')[0],
      content: contentHtml
    }

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-6 flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-black">Talyon</h1>
              </div>
              <Navigation />
            </div>
          </div>
        </header>

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
              className="max-w-none"
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
      </div>
    )
  } catch (error) {
    notFound()
  }
}
