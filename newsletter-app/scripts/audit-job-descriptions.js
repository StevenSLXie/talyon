#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function auditJobDescriptions() {
  console.log('🔍 Auditing job descriptions in database...')
  console.log('=' * 60)
  
  try {
    // Get all jobs with their descriptions
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, company, title, job_description, raw_text')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error fetching jobs:', error)
      return
    }
    
    console.log(`📊 Total jobs in database: ${jobs.length}`)
    console.log('')
    
    // Analyze job descriptions
    let withDescription = 0
    let withoutDescription = 0
    let withRawText = 0
    let withoutRawText = 0
    let shortDescriptions = 0
    let longDescriptions = 0
    
    const missingDescriptions = []
    const shortDescriptionJobs = []
    
    jobs.forEach((job, index) => {
      const hasDescription = job.job_description && job.job_description.trim().length > 0
      const hasRawText = job.raw_text && job.raw_text.trim().length > 0
      const descriptionLength = job.job_description ? job.job_description.length : 0
      
      if (hasDescription) {
        withDescription++
        if (descriptionLength < 100) {
          shortDescriptions++
          shortDescriptionJobs.push({
            id: job.id,
            company: job.company,
            title: job.title,
            length: descriptionLength
          })
        } else {
          longDescriptions++
        }
      } else {
        withoutDescription++
        missingDescriptions.push({
          id: job.id,
          company: job.company,
          title: job.title,
          hasRawText: hasRawText
        })
      }
      
      if (hasRawText) {
        withRawText++
      } else {
        withoutRawText++
      }
    })
    
    // Print summary
    console.log('📈 Job Description Analysis:')
    console.log('-' * 40)
    console.log(`✅ Jobs with descriptions: ${withDescription} (${Math.round(withDescription/jobs.length*100)}%)`)
    console.log(`❌ Jobs without descriptions: ${withoutDescription} (${Math.round(withoutDescription/jobs.length*100)}%)`)
    console.log(`📄 Jobs with raw text: ${withRawText} (${Math.round(withRawText/jobs.length*100)}%)`)
    console.log(`📄 Jobs without raw text: ${withoutRawText} (${Math.round(withoutRawText/jobs.length*100)}%)`)
    console.log('')
    
    console.log('📏 Description Length Analysis:')
    console.log('-' * 40)
    console.log(`📝 Short descriptions (<100 chars): ${shortDescriptions}`)
    console.log(`📄 Long descriptions (≥100 chars): ${longDescriptions}`)
    console.log('')
    
    // Show sample missing descriptions
    if (missingDescriptions.length > 0) {
      console.log('❌ Sample Jobs Missing Descriptions:')
      console.log('-' * 40)
      missingDescriptions.slice(0, 10).forEach((job, index) => {
        console.log(`${index + 1}. ${job.company} - ${job.title}`)
        console.log(`   ID: ${job.id}, Has Raw Text: ${job.hasRawText ? 'Yes' : 'No'}`)
      })
      
      if (missingDescriptions.length > 10) {
        console.log(`   ... and ${missingDescriptions.length - 10} more`)
      }
      console.log('')
    }
    
    // Show sample short descriptions
    if (shortDescriptionJobs.length > 0) {
      console.log('📝 Sample Jobs with Short Descriptions:')
      console.log('-' * 40)
      shortDescriptionJobs.slice(0, 5).forEach((job, index) => {
        console.log(`${index + 1}. ${job.company} - ${job.title}`)
        console.log(`   Length: ${job.length} characters`)
      })
      console.log('')
    }
    
    // Recommendations
    console.log('💡 Recommendations:')
    console.log('-' * 40)
    
    if (missingDescriptions.length > 0) {
      const withRawText = missingDescriptions.filter(job => job.hasRawText).length
      console.log(`1. ${missingDescriptions.length} jobs missing descriptions`)
      console.log(`   - ${withRawText} have raw text (can be processed)`)
      console.log(`   - ${missingDescriptions.length - withRawText} need re-scraping`)
    }
    
    if (shortDescriptions > 0) {
      console.log(`2. ${shortDescriptions} jobs have very short descriptions`)
      console.log('   - Consider enhancing these with LLM processing')
    }
    
    console.log('')
    console.log('🔧 Next Steps:')
    console.log('1. Process raw text for jobs that have it')
    console.log('2. Re-scrape jobs without raw text')
    console.log('3. Enhance short descriptions with LLM')
    
  } catch (error) {
    console.error('❌ Error during audit:', error)
  }
}

// Run the audit
auditJobDescriptions()
