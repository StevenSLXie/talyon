import type { Metadata } from 'next'

const supportedRoles = [
  'software-engineer',
  'frontend-engineer',
  'backend-engineer',
  'data-scientist',
  'ml-engineer',
  'product-manager',
]

export async function generateStaticParams() {
  return supportedRoles.map((role) => ({ role }))
}

export async function generateMetadata({ params }: { params: { role: string } }): Promise<Metadata> {
  const role = params.role.replace(/-/g, ' ')
  const title = `${capitalize(role)} jobs in Singapore | Talyon`
  const description = `Curated ${role} roles in Singapore. Anonymous trends, salary ranges, top skills, and sample JD snippets. No private data exposed.`
  return {
    title,
    description,
    alternates: { canonical: `https://talyon.asia/jobs/singapore/${params.role}` },
    openGraph: { title, description, url: `https://talyon.asia/jobs/singapore/${params.role}` },
  }
}

export default async function Page({ params }: { params: { role: string } }) {
  const role = params.role.replace(/-/g, ' ')

  // Static, anonymous insights for SEO-friendly public page (no PII or private listings)
  const stats = {
    salaryRange: 'SGD 6k–12k / month (indicative)',
    topSkills: ['TypeScript', 'React', 'Node.js', 'AWS'],
    hiringTrends: 'Steady demand in fintech, AI infra, and B2B SaaS.',
  }

  const sampleSnippets = [
    'Own end-to-end feature delivery, from design to production and observability.',
    'Improve reliability and performance while collaborating on API contracts.',
    'Contribute to component libraries and CI/CD to accelerate product teams.',
  ]

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl md:text-3xl font-semibold text-black capitalize">{role} jobs in Singapore</h1>
      <p className="mt-2 text-gray-600">Public, anonymous insights only. Personalized matches are available after sign in.</p>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-black">Salary & Skills</h2>
        <ul className="mt-3 list-disc pl-5 text-gray-700">
          <li>Typical salary range: {stats.salaryRange}</li>
          <li>Top skills: {stats.topSkills.join(', ')}</li>
          <li>Hiring trends: {stats.hiringTrends}</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-black">Sample JD snippets (synthetic)</h2>
        <ul className="mt-3 list-disc pl-5 text-gray-700">
          {sampleSnippets.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <a href="/" className="text-black underline">Get personalized matches</a>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'What are typical salaries in Singapore?', acceptedAnswer: { '@type': 'Answer', text: stats.salaryRange } },
              { '@type': 'Question', name: 'Which skills are in demand?', acceptedAnswer: { '@type': 'Answer', text: stats.topSkills.join(', ') } },
            ],
          }),
        }}
      />
    </main>
  )
}

function capitalize(s: string) {
  return s.replace(/^\w|-\w/g, (m) => m.toUpperCase())
}


