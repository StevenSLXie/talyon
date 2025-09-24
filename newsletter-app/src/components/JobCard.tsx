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

  const formatSalary = (low: number, high: number) => {
    return `$${low.toLocaleString()} - $${high.toLocaleString()}`
  }

  const getIndustryColor = (industry: string) => {
    const colors: { [key: string]: string } = {
      'Engineering': 'bg-blue-100 text-blue-800',
      'Information Technology': 'bg-green-100 text-green-800',
      'Banking & Finance': 'bg-purple-100 text-purple-800',
      'Healthcare': 'bg-red-100 text-red-800',
      'Education': 'bg-yellow-100 text-yellow-800',
      'Admin': 'bg-gray-100 text-gray-800',
      'Manufacturing': 'bg-indigo-100 text-indigo-800'
    }
    return colors[industry] || 'bg-gray-100 text-gray-800'
  }

  const getJobTypeColor = (jobType: string) => {
    return jobType === 'Full Time' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-orange-100 text-orange-800'
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 border border-gray-100">
      {/* Company & Title */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
          {job.title}
        </h3>
        <p className="text-sm text-gray-600 font-medium">
          {job.company}
        </p>
      </div>

      {/* Salary */}
      <div className="mb-4">
        <div className="text-xl font-bold text-green-600">
          {formatSalary(job.salary_low, job.salary_high)}
        </div>
        <div className="text-sm text-gray-500">per month</div>
      </div>

      {/* Location */}
      <div className="mb-4">
        <div className="flex items-center text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">{job.location}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getIndustryColor(job.industry)}`}>
          {job.industry}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getJobTypeColor(job.job_type)}`}>
          {job.job_type}
        </span>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {job.experience_level}
        </span>
      </div>

      {/* Apply Button */}
      <Link
        href={job.job_hash ? `/jobs/${job.job_hash}` : '#'}
        className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors text-center"
      >
        View Details
      </Link>
    </div>
  )
}
