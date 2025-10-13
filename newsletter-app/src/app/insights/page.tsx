import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Insights: Singapore Tech Job Market | Talyon',
  description: 'Public, anonymized reports and guides about Singapore tech hiring: salaries, skills, and trends. Updated regularly.',
  alternates: { canonical: 'https://talyon.asia/insights' },
  openGraph: {
    title: 'Insights: Singapore Tech Job Market | Talyon',
    description: 'Anonymized reports about salaries, skills, and hiring trends in Singapore.',
    url: 'https://talyon.asia/insights',
  },
}

export default function InsightsPage() {
  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl md:text-3xl font-semibold text-black">Insights: Singapore Tech Job Market</h1>
      <p className="mt-2 text-gray-600 max-w-2xl">
        Public, anonymized insights generated from aggregated market signals. No private listings or personal data are disclosed here.
      </p>

      <section className="mt-8 grid md:grid-cols-2 gap-8">
        <article className="border border-gray-200 p-6 bg-white">
          <h2 className="text-xl font-medium text-black">Salary ranges by role</h2>
          <p className="text-gray-600 mt-2">Indicative monthly ranges (SGD) based on public sources and synthetic benchmarks.</p>
          <ul className="list-disc pl-5 mt-3 text-gray-700">
            <li>Software Engineer: 6k–12k</li>
            <li>Data Scientist: 6k–13k</li>
            <li>ML Engineer: 7k–15k</li>
          </ul>
        </article>

        <article className="border border-gray-200 p-6 bg-white">
          <h2 className="text-xl font-medium text-black">In-demand skills</h2>
          <p className="text-gray-600 mt-2">TypeScript, React, Python, AWS, Kubernetes, GenAI tooling.</p>
        </article>
      </section>

      <section className="mt-10">
        <a href="/" className="text-black underline">Get personalized matches</a>
      </section>
    </main>
  )
}


