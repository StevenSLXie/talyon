// Script to populate jobs database from consolidated JSON file
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function populateJobs() {
  try {
    // Read the consolidated jobs JSON file
    const jsonPath = path.join(__dirname, '../../output/consolidated_jobs_20250921_205754.json')
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`Jobs file not found: ${jsonPath}`)
      process.exit(1)
    }

    const jobsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const jobs = jobsData.jobs || []

    console.log(`Found ${jobs.length} jobs to import`)

    // Clear existing jobs (optional - remove if you want to keep existing data)
    console.log('Clearing existing jobs...')
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

    if (deleteError) {
      console.error('Error clearing jobs:', deleteError)
    } else {
      console.log('Existing jobs cleared')
    }

    // Insert jobs in batches
    const batchSize = 100
    let insertedCount = 0
    let errorCount = 0

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)
      
      // Transform job data to match our schema
      const transformedBatch = batch.map(job => ({
        company: job.company,
        title: job.title,
        location: job.location,
        salary_low: job.salary_low,
        salary_high: job.salary_high,
        industry: job.industry,
        job_type: job.job_type,
        experience_level: job.experience_level,
        post_date: job.post_date ? new Date(job.post_date).toISOString().split('T')[0] : null,
        job_hash: job.job_hash,
        url: job.url,
        job_description: job.job_description,
        job_category: job.job_category,
        raw_text: job.raw_text
      }))

      const { data, error } = await supabase
        .from('jobs')
        .insert(transformedBatch)

      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error)
        errorCount += batch.length
      } else {
        insertedCount += batch.length
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} jobs`)
      }
    }

    console.log(`\nImport completed:`)
    console.log(`- Successfully inserted: ${insertedCount} jobs`)
    console.log(`- Errors: ${errorCount} jobs`)
    console.log(`- Total processed: ${jobs.length} jobs`)

  } catch (error) {
    console.error('Error populating jobs:', error)
    process.exit(1)
  }
}

// Run the script
populateJobs()
