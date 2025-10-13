import type { Metadata } from 'next'

export async function generateStaticParams() {
  return [
    { slug: 'senior-frontend-engineer-singapore' },
    { slug: 'software-engineer-singapore' },
  ]
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const title = `${params.slug.replace(/-/g, ' ')} (Demo) | Talyon`
  const description = 'Synthetic job description for SEO indexing. No private or confidential data. Personalized listings available after sign in.'
  return {
    title,
    description,
    alternates: { canonical: `https://talyon.asia/demo-jobs/${params.slug}` },
    openGraph: { title, description, url: `https://talyon.asia/demo-jobs/${params.slug}` },
  }
}

export default function DemoJobPage({ params }: { params: { slug: string } }) {
  const job = {
    title: params.slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) + ' (Demo)',
    descriptionHtml: '<p>Lead feature delivery, collaborate with cross-functional teams, and drive quality through testing and observability. Improve performance and DX.</p><ul><li>TypeScript, React, Node.js</li><li>CI/CD, Cloud</li><li>Ownership mindset</li></ul>',
    company: { name: 'Growing Tech Company (Demo)', website: 'https://talyon.asia' },
    city: 'Singapore', region: 'SG', country: 'SG',
    currency: 'SGD', min: 90000, max: 180000, validThrough: '2026-12-31',
    remote: true,
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl md:text-3xl font-semibold text-black">{job.title}</h1>
      <p className="text-gray-600">Demo-only public page. Real personalized matches are private.</p>
      <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: job.descriptionHtml }} />

      <section className="mt-8">
        <a href="/" className="text-black underline">Get personalized matches</a>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: job.title,
            description: job.descriptionHtml,
            datePosted: '2025-01-01',
            employmentType: 'FULL_TIME',
            hiringOrganization: {
              '@type': 'Organization',
              name: job.company.name,
              sameAs: job.company.website,
            },
            jobLocation: {
              '@type': 'Place',
              address: { '@type': 'PostalAddress', addressLocality: job.city, addressRegion: job.region, addressCountry: job.country },
            },
            baseSalary: {
              '@type': 'MonetaryAmount',
              currency: job.currency,
              value: { '@type': 'QuantitativeValue', minValue: job.min, maxValue: job.max, unitText: 'YEAR' },
            },
            validThrough: job.validThrough,
            applicantLocationRequirements: job.remote ? 'Remote' : 'Onsite',
          }),
        }}
      />
    </main>
  )
}


