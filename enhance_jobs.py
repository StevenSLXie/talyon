#!/usr/bin/env python3
"""
Job Enhancement Script
Enhances existing jobs with structured profile data using LLM analysis
Extends the consolidate_jobs.py workflow
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
import openai
from supabase import create_client, Client
import sys

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class JobEnhancer:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.enhanced_jobs = []
        self.failed_jobs = []
        
    def load_consolidated_jobs(self, file_path: str) -> List[Dict]:
        """Load jobs from consolidated JSON file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            jobs = data.get('jobs', [])
            logger.info(f"Loaded {len(jobs)} jobs from {file_path}")
            return jobs
            
        except Exception as e:
            logger.error(f"Error loading consolidated jobs file: {str(e)}")
            return []
    
    def get_enhancement_prompt(self, job: Dict) -> str:
        """Generate LLM prompt for job enhancement"""
        return f"""
        Analyze this job description and extract a comprehensive job profile in structured format.
        
        Job Description: {job.get('job_description', '')}
        Company: {job.get('company', '')}
        Title: {job.get('title', '')}
        Industry: {job.get('industry', '')}
        Salary: {job.get('salary_low', 0)}-{job.get('salary_high', 0)}
        
        Extract the following information and return as JSON:
        {{
            "company_tier": "MNC|GLC|Educational Institution|SME",
            "title_clean": "string",
            "job_family": "string",
            "seniority_level": "Intern|Junior|Mid|Senior|Lead|Manager|Director|Executive",
            "remote_policy": "Onsite|Hybrid|Remote",
            "visa_requirement": {{
                "local_only": boolean,
                "ep_ok": boolean
            }},
            "experience_years_req": {{
                "min": number,
                "max": number
            }},
            "education_req": ["string1", "string2"],
            "certifications_req": ["string1", "string2"],
            "skills_required": [
                {{
                    "name": "string",
                    "level": 1-5
                }}
            ],
            "skills_optional": ["string1", "string2"],
            "job_functions": ["string1", "string2"],
            "currency": "SGD",
            "expires_at": "YYYY-MM-DD",
            "trust_score": 0.0-1.0,
            "source_site": "string",
            "source_url": "string"
        }}
        
        Guidelines:
        - Skills level: 1=Beginner, 2=Basic, 3=Intermediate, 4=Advanced, 5=Expert
        - Infer experience requirements from job description if not explicitly stated
        - Map company to tier based on name recognition (MNC/GLC/Educational Institution/SME)
        - Extract job functions from responsibilities section
        - Determine visa requirements from location and company type
        - Be conservative with estimates when information is unclear
        """
    
    async def enhance_job_with_llm(self, job: Dict) -> Optional[Dict]:
        """Enhance a single job using LLM"""
        try:
            prompt = self.get_enhancement_prompt(job)
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert job analyst specializing in the Singapore job market. You excel at extracting structured information from job descriptions, understanding company requirements, and categorizing job profiles. You have deep knowledge of Singapore companies, work authorization requirements, and industry standards. Always respond in valid JSON format as requested."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            if content:
                enhanced_data = json.loads(content)
                logger.info(f"Successfully enhanced job: {job.get('title', 'Unknown')} at {job.get('company', 'Unknown')}")
                return enhanced_data
            else:
                logger.warning(f"No content returned from LLM for job: {job.get('title', 'Unknown')}")
                return None
                
        except Exception as e:
            logger.error(f"Error enhancing job {job.get('title', 'Unknown')}: {str(e)}")
            return None
    
    def categorize_skill(self, skill_name: str) -> str:
        """Categorize skill into skill category"""
        skill = skill_name.lower()
        
        if skill in ['python', 'javascript', 'java', 'c++', 'go', 'rust', 'swift', 'kotlin', 'php', 'ruby', 'scala']:
            return 'Programming Language'
        if skill in ['react', 'vue', 'angular', 'node.js', 'django', 'flask', 'spring', 'laravel']:
            return 'Framework'
        if skill in ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch']:
            return 'Database'
        if skill in ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform']:
            return 'DevOps/Cloud'
        if skill in ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'llm', 'nlp', 'computer vision']:
            return 'AI/ML'
        if skill in ['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'tableau', 'power bi']:
            return 'Data Analysis'
        
        return 'Other'
    
    async def save_enhanced_job_to_db(self, job: Dict, enhanced_data: Dict) -> bool:
        """Save enhanced job data to Supabase database"""
        try:
            job_id = job.get('id')
            if not job_id:
                logger.warning(f"No job ID found for job: {job.get('title', 'Unknown')} - skipping database save")
                # For testing, just return True to continue processing
                return True
            
            # Update main jobs table with enhanced data
            update_data = {
                'company_tier': enhanced_data.get('company_tier', 'SME'),
                'title_clean': enhanced_data.get('title_clean', job.get('title')),
                'job_family': enhanced_data.get('job_family', 'General'),
                'seniority_level': enhanced_data.get('seniority_level', 'Mid'),
                'remote_policy': enhanced_data.get('remote_policy', 'Onsite'),
                'visa_requirement': enhanced_data.get('visa_requirement', {'local_only': False, 'ep_ok': True}),
                'experience_years_req': enhanced_data.get('experience_years_req', {'min': 1, 'max': 5}),
                'education_req': enhanced_data.get('education_req', []),
                'certifications_req': enhanced_data.get('certifications_req', []),
                'skills_required': enhanced_data.get('skills_required', []),
                'skills_optional': enhanced_data.get('skills_optional', []),
                'job_functions': enhanced_data.get('job_functions', []),
                'currency': enhanced_data.get('currency', 'SGD'),
                'expires_at': enhanced_data.get('expires_at'),
                'trust_score': enhanced_data.get('trust_score', 0.5),
                'source_site': enhanced_data.get('source_site', 'MyCareersFuture'),
                'source_url': enhanced_data.get('source_url', job.get('url')),
                'profile_version': 2
            }
            
            # Update jobs table
            result = self.supabase.table('jobs').update(update_data).eq('id', job_id).execute()
            
            if result.data:
                logger.info(f"Updated job {job_id} in database")
            else:
                logger.error(f"Failed to update job {job_id} in database")
                return False
            
            # Clear existing skills
            self.supabase.table('job_skills_required').delete().eq('job_id', job_id).execute()
            self.supabase.table('job_skills_optional').delete().eq('job_id', job_id).execute()
            
            # Insert required skills
            if enhanced_data.get('skills_required'):
                required_skills_data = []
                for skill in enhanced_data['skills_required']:
                    required_skills_data.append({
                        'job_id': job_id,
                        'skill_name': skill.get('name', ''),
                        'skill_level': skill.get('level', 3),
                        'skill_category': self.categorize_skill(skill.get('name', ''))
                    })
                
                if required_skills_data:
                    self.supabase.table('job_skills_required').insert(required_skills_data).execute()
                    logger.info(f"Inserted {len(required_skills_data)} required skills for job {job_id}")
            
            # Insert optional skills
            if enhanced_data.get('skills_optional'):
                optional_skills_data = []
                for skill in enhanced_data['skills_optional']:
                    optional_skills_data.append({
                        'job_id': job_id,
                        'skill_name': skill,
                        'skill_category': self.categorize_skill(skill)
                    })
                
                if optional_skills_data:
                    self.supabase.table('job_skills_optional').insert(optional_skills_data).execute()
                    logger.info(f"Inserted {len(optional_skills_data)} optional skills for job {job_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving enhanced job to database: {str(e)}")
            return False
    
    async def enhance_jobs_batch(self, jobs: List[Dict], batch_size: int = 5, delay: float = 2.0) -> List[Dict]:
        """Enhance jobs in batches to avoid rate limits"""
        logger.info(f"Starting to enhance {len(jobs)} jobs in batches of {batch_size}")
        
        enhanced_jobs = []
        
        for i in range(0, len(jobs), batch_size):
            batch = jobs[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(jobs) + batch_size - 1) // batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} jobs)")
            
            # Process current batch
            for job in batch:
                try:
                    # Enhance job with LLM
                    enhanced_data = await self.enhance_job_with_llm(job)
                    
                    if enhanced_data:
                        # Save to database
                        success = await self.save_enhanced_job_to_db(job, enhanced_data)
                        
                        if success:
                            enhanced_jobs.append({
                                'original_job': job,
                                'enhanced_data': enhanced_data,
                                'status': 'success'
                            })
                            logger.info(f"Successfully processed job: {job.get('title', 'Unknown')} at {job.get('company', 'Unknown')}")
                        else:
                            self.failed_jobs.append({
                                'job': job,
                                'error': 'Failed to save to database',
                                'status': 'failed'
                            })
                    else:
                        self.failed_jobs.append({
                            'job': job,
                            'error': 'Failed to enhance with LLM',
                            'status': 'failed'
                        })
                    
                    # Small delay between jobs
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Error processing job {job.get('title', 'Unknown')}: {str(e)}")
                    self.failed_jobs.append({
                        'job': job,
                        'error': str(e),
                        'status': 'failed'
                    })
            
            # Add delay between batches
            if i + batch_size < len(jobs):
                logger.info(f"Waiting {delay} seconds before next batch...")
                await asyncio.sleep(delay)
        
        self.enhanced_jobs = enhanced_jobs
        logger.info(f"Completed enhancement. Total jobs enhanced: {len(enhanced_jobs)}")
        return enhanced_jobs
    
    def save_enhancement_results(self, filename: Optional[str] = None) -> str:
        """Save enhancement results to JSON file"""
        if not self.enhanced_jobs:
            logger.warning("No enhanced jobs to save")
            return ""
        
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"output/enhanced_jobs_{timestamp}.json"
        
        # Create metadata
        metadata = {
            'generated_at': datetime.now().isoformat(),
            'total_enhanced': len(self.enhanced_jobs),
            'total_failed': len(self.failed_jobs),
            'description': 'Enhanced job data with structured profiles extracted using LLM',
            'enhancer_version': '1.0'
        }
        
        output_data = {
            'metadata': metadata,
            'enhanced_jobs': self.enhanced_jobs,
            'failed_jobs': self.failed_jobs
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved enhancement results to {filename}")
        return filename
    
    def print_summary(self):
        """Print summary of enhancement process"""
        logger.info(f"Total jobs enhanced: {len(self.enhanced_jobs)}")
        logger.info(f"Total jobs failed: {len(self.failed_jobs)}")
        
        if self.enhanced_jobs:
            sample_job = self.enhanced_jobs[0]
            logger.info("\nSample enhanced job:")
            logger.info(f"  Title: {sample_job['original_job'].get('title', 'Unknown')}")
            logger.info(f"  Company: {sample_job['original_job'].get('company', 'Unknown')}")
            logger.info(f"  Enhanced Skills: {len(sample_job['enhanced_data'].get('skills_required', []))}")
            logger.info(f"  Company Tier: {sample_job['enhanced_data'].get('company_tier', 'Unknown')}")

async def main():
    """Main function to run the enhancement process"""
    
    # Configuration
    consolidated_jobs_file = "output/consolidated_jobs_20250921_205754.json"
    max_jobs = 3     # Set to None for all jobs, or a number for testing
    batch_size = 2   # Number of jobs to enhance in each batch
    delay = 2.0      # Delay between batches in seconds
    
    # Environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    openai_api_key = os.getenv('OPENAI_API_KEY')
    
    if not all([supabase_url, supabase_key, openai_api_key]):
        logger.error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
        sys.exit(1)
    
    logger.info("Starting job enhancement process...")
    logger.info(f"Consolidated jobs file: {consolidated_jobs_file}")
    logger.info(f"Max jobs to process: {max_jobs or 'All'}")
    logger.info(f"Batch size: {batch_size}")
    logger.info(f"Delay between batches: {delay}s")
    
    try:
        # Initialize enhancer
        enhancer = JobEnhancer(supabase_url, supabase_key, openai_api_key)
        
        # Load consolidated jobs
        jobs = enhancer.load_consolidated_jobs(consolidated_jobs_file)
        if not jobs:
            logger.error("No jobs loaded. Exiting.")
            return
        
        # Limit jobs if specified
        if max_jobs:
            jobs = jobs[:max_jobs]
            logger.info(f"Limited to first {max_jobs} jobs for processing")
        
        # Enhance jobs
        enhanced_jobs = await enhancer.enhance_jobs_batch(jobs, batch_size, delay)
        
        if enhanced_jobs:
            # Print summary
            enhancer.print_summary()
            
            # Save results
            output_file = enhancer.save_enhancement_results()
            
            logger.info(f"\nEnhancement completed successfully!")
            logger.info(f"Total jobs enhanced: {len(enhanced_jobs)}")
            logger.info(f"Total jobs failed: {len(enhancer.failed_jobs)}")
            logger.info(f"Output file: {output_file}")
        else:
            logger.error("No jobs were enhanced")
            
    except Exception as e:
        logger.error(f"Enhancement failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
