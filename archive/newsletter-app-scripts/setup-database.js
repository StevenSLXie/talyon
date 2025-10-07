// Complete database setup script
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please check your .env.local file contains:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n')

  try {
    // Step 1: Create storage bucket for resumes
    console.log('📁 Creating storage bucket for resumes...')
    try {
      const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('resumes', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
      })
      
      if (bucketError && !bucketError.message.includes('already exists')) {
        throw bucketError
      }
      console.log('✅ Storage bucket created successfully')
    } catch (error) {
      console.log('ℹ️  Storage bucket already exists or error:', error.message)
    }

    // Step 2: Set up storage policies
    console.log('🔒 Setting up storage policies...')
    try {
      // Policy for uploading resumes
      const { error: uploadPolicyError } = await supabase.rpc('create_policy_if_not_exists', {
        policy_name: 'Users can upload resumes',
        table_name: 'storage.objects',
        policy_definition: "bucket_id = 'resumes'",
        policy_action: 'INSERT'
      })
      
      // Policy for viewing resumes
      const { error: viewPolicyError } = await supabase.rpc('create_policy_if_not_exists', {
        policy_name: 'Users can view own resumes',
        table_name: 'storage.objects',
        policy_definition: "bucket_id = 'resumes'",
        policy_action: 'SELECT'
      })
      
      console.log('✅ Storage policies set up')
    } catch (error) {
      console.log('ℹ️  Storage policies setup skipped (may already exist)')
    }

    // Step 3: Populate jobs from JSON file
    console.log('📊 Populating jobs from JSON file...')
    await populateJobsFromJSON()

    console.log('\n🎉 Database setup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Run: npm install')
    console.log('2. Run: npm run dev')
    console.log('3. Visit: http://localhost:3000')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    process.exit(1)
  }
}

async function populateJobsFromJSON() {
  try {
    // Read the consolidated jobs JSON file
    const jsonPath = path.join(__dirname, '../../output/consolidated_jobs_20250921_205754.json')
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Jobs file not found: ${jsonPath}`)
      console.error('Please make sure the consolidated jobs JSON file exists in the output directory')
      return
    }

    const jobsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const jobs = jobsData.jobs || []

    console.log(`📋 Found ${jobs.length} jobs to import`)

    // Clear existing jobs (optional - remove if you want to keep existing data)
    console.log('🗑️  Clearing existing jobs...')
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

    if (deleteError) {
      console.error('❌ Error clearing jobs:', deleteError)
    } else {
      console.log('✅ Existing jobs cleared')
    }

    // Insert jobs in batches
    const batchSize = 100
    let insertedCount = 0
    let errorCount = 0

    console.log('📥 Inserting jobs in batches...')
    
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
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message)
        errorCount += batch.length
      } else {
        insertedCount += batch.length
        const progress = Math.round((insertedCount / jobs.length) * 100)
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} jobs (${progress}% complete)`)
      }
    }

    console.log(`\n📊 Import Summary:`)
    console.log(`- Successfully inserted: ${insertedCount} jobs`)
    console.log(`- Errors: ${errorCount} jobs`)
    console.log(`- Total processed: ${jobs.length} jobs`)

  } catch (error) {
    console.error('❌ Error populating jobs:', error)
    throw error
  }
}

// Run the setup
setupDatabase()
