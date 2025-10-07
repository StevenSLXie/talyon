import Link from 'next/link'

interface Job {
  company: string
  title: string
  location: string
  salary_low: number
  salary_high: number
  industry: string
  job_type: string
  experience_level: string
  job_hash?: string
}

interface JobCardProps {
  job: Job
}

export default function JobCard({ job }: JobCardProps) {
  // Debug logging
  if (!job) {
    console.error('JobCard received undefined job:', job);
    return <div>Error: No job data</div>;
  }

  return (
    <div className="bg-white border border-gray-200 hover:border-black transition-colors duration-200 p-6">
      {/* Company & Title */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-black mb-2 line-clamp-2">
          {job.title}
        </h3>
        <p className="text-sm text-gray-600 font-medium">
          {job.company}
        </p>
      </div>

      {/* Salary */}
      <div className="mb-6">
        <div className="text-xl font-light text-black">
          {`$${job.salary_low.toLocaleString()} - $${job.salary_high.toLocaleString()}`}
        </div>
        <div className="text-sm text-gray-500">per month</div>
      </div>

      {/* Location */}
      <div className="mb-6">
        <div className="flex items-center text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">{job.location}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800">
          {job.industry}
        </span>
        <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800">
          {job.job_type}
        </span>
        <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800">
          {job.experience_level}
        </span>
      </div>

      {/* Apply Button */}
      <Link
        href={job.job_hash ? `/jobs/${job.job_hash}` : '#'}
        className="block w-full bg-black text-white py-3 px-4 text-sm font-medium hover:bg-gray-800 transition-colors text-center"
      >
        View Details
      </Link>
    </div>
  )
}
