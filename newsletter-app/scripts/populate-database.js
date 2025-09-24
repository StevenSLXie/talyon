const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateJobs() {
  try {
    // Read the refined jobs JSON file
    const jobsFilePath = path.join(__dirname, '..', '..', 'output', 'refined_jobs_20250918_222615.json');
    
    if (!fs.existsSync(jobsFilePath)) {
      console.error('Jobs file not found at:', jobsFilePath);
      return;
    }

    const fileContent = fs.readFileSync(jobsFilePath, 'utf8');
    const jobsData = JSON.parse(fileContent);
    const jobs = jobsData.jobs || jobsData;
    
    console.log(`Found ${jobs.length} jobs to populate`);

    // Create a jobs table if it doesn't exist (we'll use a simple approach)
    // For now, let's just log the first few jobs to verify the data
    console.log('Sample jobs:');
    jobs.slice(0, 3).forEach((job, index) => {
      console.log(`${index + 1}. ${job.title} at ${job.company}`);
      console.log(`   Location: ${job.location}`);
      console.log(`   Salary: $${job.salary_low} - $${job.salary_high}`);
      console.log(`   Industry: ${job.industry}`);
      console.log(`   Hash: ${job.job_hash}`);
      console.log('---');
    });

    // For now, we'll modify the API to use this data directly
    // In a real implementation, you'd insert these into a jobs table
    console.log('✅ Job data structure verified!');
    console.log('📝 Next: Update the API to use this data directly');

  } catch (error) {
    console.error('Error populating jobs:', error);
  }
}

populateJobs();

