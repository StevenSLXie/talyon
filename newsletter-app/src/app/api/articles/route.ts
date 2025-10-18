import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const articlesDirectory = path.join(process.cwd(), 'public/articles')

export interface Article {
  slug: string
  title: string
  date: string
  excerpt: string
  content: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (slug) {
      // Return specific article
      return await getArticle(slug)
    } else {
      // Return all articles
      return await getAllArticles()
    }
  } catch (error) {
    console.error('Articles API error:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

async function getAllArticles(): Promise<NextResponse> {
  try {
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
          date: data.date || new Date().toISOString(),
          excerpt: data.excerpt || content.substring(0, 200) + '...',
          content: content
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Error reading articles:', error)
    return NextResponse.json({ error: 'Failed to read articles' }, { status: 500 })
  }
}

async function getArticle(slug: string): Promise<NextResponse> {
  try {
    const filePath = path.join(articlesDirectory, `${slug}.md`)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    
    const article: Article = {
      slug,
      title: data.title || slug.replace(/-/g, ' '),
      date: data.date || new Date().toISOString(),
      excerpt: data.excerpt || content.substring(0, 200) + '...',
      content: content
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Error reading article:', error)
    return NextResponse.json({ error: 'Failed to read article' }, { status: 500 })
  }
}
