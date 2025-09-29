#!/usr/bin/env python3
"""
Data Migration Script for Enhanced Job Schema
Transforms existing job data to the new enhanced schema with structured profiles
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any
import asyncio
from supabase import create_client, Client
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class JobDataMigration:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if not all([self.supabase_url, self.supabase_key, self.openai_api_key]):
            raise ValueError("Missing required environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        openai.api_key = self.openai_api_key
        
        self.migration_stats = {
            'total_jobs': 0,
            'enhanced_jobs': 0,
            'failed_jobs': 0,
            'skipped_jobs': 0
        }

    async def migrate_jobs_from_consolidated_file(self, file_path: str, batch_size: int = 10):
        """Migrate jobs from consolidated JSON file to enhanced schema"""
        print(f"Starting migration from {file_path}")
        
        # Load consolidated jobs
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        jobs = data.get('jobs', [])
        self.migration_stats['total_jobs'] = len(jobs)
        
        print(f"Found {len(jobs)} jobs to migrate")
        
        # Process jobs in batches
        for i in range(0, len(jobs), batch_size):
            batch = jobs[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}/{(len(jobs) + batch_size - 1)//batch_size}")
            
            await self.process_job_batch(batch)
            
            # Small delay between batches
            await asyncio.sleep(1)
        
        self.print_migration_summary()

    async def process_job_batch(self, jobs: List[Dict[str, Any]]):
        """Process a batch of jobs"""
        for job in jobs:
            try:
                await self.migrate_single_job(job)
            except Exception as e:
                print(f"Failed to migrate job {job.get('title', 'Unknown')}: {e}")
                self.migration_stats['failed_jobs'] += 1

    async def migrate_single_job(self, job_data: Dict[str, Any]):
        """Migrate a single job to the enhanced schema"""
        try:
            # Check if job already exists
            existing_job = await self.check_existing_job(job_data)
            if existing_job:
                print(f"Job already exists: {job_data.get('title', 'Unknown')}")
                self.migration_stats['skipped_jobs'] += 1
                return

            # Enhance job with LLM analysis
            enhanced_data = await self.enhance_job_with_llm(job_data)
            
            if not enhanced_data:
                print(f"Failed to enhance job: {job_data.get('title', 'Unknown')}")
                self.migration_stats['failed_jobs'] += 1
                return

            # Insert into enhanced jobs table
            await self.insert_enhanced_job(job_data, enhanced_data)
            
            # Insert skills data
            await self.insert_job_skills(job_data, enhanced_data)
            
            self.migration_stats['enhanced_jobs'] += 1
            print(f"Successfully migrated: {job_data.get('title', 'Unknown')}")
            
        except Exception as e:
            print(f"Error migrating job {job_data.get('title', 'Unknown')}: {e}")
            self.migration_stats['failed_jobs'] += 1

    async def check_existing_job(self, job_data: Dict[str, Any]) -> bool:
        """Check if job already exists in the database"""
        try:
            # Use job_hash as unique identifier
            job_hash = job_data.get('job_hash')
            if not job_hash:
                return False
            
            result = self.supabase.table('jobs').select('id').eq('job_hash', job_hash).execute()
            return len(result.data) > 0
        except Exception as e:
            print(f"Error checking existing job: {e}")
            return False

    async def enhance_job_with_llm(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance job data using LLM analysis"""
        try:
            prompt = self.build_job_enhancement_prompt(job_data)
            
            response = await openai.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert job analyst specializing in the Singapore job market. Extract structured data from job descriptions and return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            enhanced_data = json.loads(response.choices[0].message.content)
            return enhanced_data
            
        except Exception as e:
            print(f"LLM enhancement failed: {e}")
            return None

    def build_job_enhancement_prompt(self, job_data: Dict[str, Any]) -> str:
        """Build prompt for job enhancement"""
        return f"""
        Analyze this job posting and extract structured data in JSON format.
        
        Job Title: {job_data.get('title', '')}
        Company: {job_data.get('company', '')}
        Location: {job_data.get('location', '')}
        Salary: ${job_data.get('salary_low', 0)} - ${job_data.get('salary_high', 0)}
        Industry: {job_data.get('industry', '')}
        Job Type: {job_data.get('job_type', '')}
        Experience Level: {job_data.get('experience_level', '')}
        
        Job Description:
        {job_data.get('job_description', '')[:2000]}  # Limit to first 2000 chars
        
        Extract and return this JSON structure:
        {{
            "company_tier": "MNC|GLC|Educational Institution|SME",
            "title_clean": "Normalized job title",
            "job_family": "Engineering|IT|Finance|Marketing|Operations|Sales|HR|Other",
            "seniority_level": "Entry|Mid|Senior|Lead|Manager|Director|Executive",
            "remote_policy": "Onsite|Hybrid|Remote",
            "visa_requirement": {{
                "local_only": false,
                "ep_ok": true,
                "sp_ok": false,
                "wp_ok": false
            }},
            "experience_years_req": {{
                "min": 3,
                "max": 5
            }},
            "education_req": ["Bachelor's degree", "Master's degree preferred"],
            "certifications_req": ["AWS Certified", "PMP"],
            "skills_required": [
                {{"name": "Python", "level": 4}},
                {{"name": "React", "level": 3}}
            ],
            "skills_optional": ["Docker", "Kubernetes"],
            "job_functions": ["Software Development", "Code Review", "Team Leadership"],
            "currency": "SGD",
            "expires_at": "2024-12-31",
            "trust_score": 0.85,
            "source_site": "MyCareersFuture",
            "source_url": "{job_data.get('url', '')}"
        }}
        
        Guidelines:
        - Company tier: MNC for multinationals, GLC for government-linked companies, Educational Institution for schools/universities, SME for others
        - Skills levels: 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master
        - Experience years: Extract from job description or infer from seniority level
        - Education: Extract specific degree requirements
        - Certifications: Extract specific certification requirements
        - Skills: Focus on technical and professional skills mentioned
        - Job functions: Core responsibilities and duties
        """

    async def insert_enhanced_job(self, job_data: Dict[str, Any], enhanced_data: Dict[str, Any]):
        """Insert job into enhanced jobs table"""
        try:
            job_record = {
                'job_hash': job_data.get('job_hash'),
                'title': job_data.get('title'),
                'company': job_data.get('company'),
                'location': job_data.get('location'),
                'salary_low': job_data.get('salary_low'),
                'salary_high': job_data.get('salary_high'),
                'industry': job_data.get('industry'),
                'job_type': job_data.get('job_type'),
                'experience_level': job_data.get('experience_level'),
                'url': job_data.get('url'),
                'job_description': job_data.get('job_description'),
                'post_date': job_data.get('post_date'),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                # Enhanced fields
                'company_tier': enhanced_data.get('company_tier', 'SME'),
                'title_clean': enhanced_data.get('title_clean', job_data.get('title')),
                'job_family': enhanced_data.get('job_family', 'Other'),
                'seniority_level': enhanced_data.get('seniority_level', 'Mid'),
                'remote_policy': enhanced_data.get('remote_policy', 'Onsite'),
                'visa_requirement': enhanced_data.get('visa_requirement', {}),
                'experience_years_req': enhanced_data.get('experience_years_req', {}),
                'education_req': enhanced_data.get('education_req', []),
                'certifications_req': enhanced_data.get('certifications_req', []),
                'skills_required': enhanced_data.get('skills_required', []),
                'skills_optional': enhanced_data.get('skills_optional', []),
                'job_functions': enhanced_data.get('job_functions', []),
                'currency': enhanced_data.get('currency', 'SGD'),
                'expires_at': enhanced_data.get('expires_at', '2024-12-31'),
                'trust_score': enhanced_data.get('trust_score', 0.8),
                'source_site': enhanced_data.get('source_site', 'MyCareersFuture'),
                'source_url': enhanced_data.get('source_url', ''),
                'profile_version': '1.0'
            }
            
            result = self.supabase.table('jobs').insert(job_record).execute()
            
            if not result.data:
                raise Exception("Failed to insert job record")
            
            return result.data[0]['id']
            
        except Exception as e:
            print(f"Error inserting enhanced job: {e}")
            raise

    async def insert_job_skills(self, job_data: Dict[str, Any], enhanced_data: Dict[str, Any]):
        """Insert job skills into separate tables"""
        try:
            job_id = await self.get_job_id_by_hash(job_data.get('job_hash'))
            if not job_id:
                raise Exception("Job ID not found")
            
            # Insert required skills
            required_skills = enhanced_data.get('skills_required', [])
            if required_skills:
                skills_data = []
                for skill in required_skills:
                    skills_data.append({
                        'job_id': job_id,
                        'skill_name': skill.get('name', ''),
                        'skill_level': skill.get('level', 3),
                        'skill_category': self.categorize_skill(skill.get('name', ''))
                    })
                
                if skills_data:
                    self.supabase.table('job_skills_required').insert(skills_data).execute()
            
            # Insert optional skills
            optional_skills = enhanced_data.get('skills_optional', [])
            if optional_skills:
                skills_data = []
                for skill in optional_skills:
                    skills_data.append({
                        'job_id': job_id,
                        'skill_name': skill,
                        'skill_category': self.categorize_skill(skill)
                    })
                
                if skills_data:
                    self.supabase.table('job_skills_optional').insert(skills_data).execute()
                    
        except Exception as e:
            print(f"Error inserting job skills: {e}")
            raise

    async def get_job_id_by_hash(self, job_hash: str) -> str:
        """Get job ID by job hash"""
        try:
            result = self.supabase.table('jobs').select('id').eq('job_hash', job_hash).execute()
            if result.data:
                return result.data[0]['id']
            return None
        except Exception as e:
            print(f"Error getting job ID: {e}")
            return None

    def categorize_skill(self, skill_name: str) -> str:
        """Categorize skill into predefined categories"""
        skill_lower = skill_name.lower()
        
        if any(keyword in skill_lower for keyword in ['python', 'java', 'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'express']):
            return 'Programming Languages'
        elif any(keyword in skill_lower for keyword in ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform']):
            return 'Cloud & DevOps'
        elif any(keyword in skill_lower for keyword in ['sql', 'mysql', 'postgresql', 'mongodb', 'redis']):
            return 'Database'
        elif any(keyword in skill_lower for keyword in ['machine learning', 'ai', 'tensorflow', 'pytorch', 'pandas', 'numpy']):
            return 'Data Science'
        elif any(keyword in skill_lower for keyword in ['project management', 'agile', 'scrum', 'kanban']):
            return 'Project Management'
        elif any(keyword in skill_lower for keyword in ['sales', 'marketing', 'business development']):
            return 'Business'
        else:
            return 'Other'

    def print_migration_summary(self):
        """Print migration summary"""
        print("\n" + "="*50)
        print("MIGRATION SUMMARY")
        print("="*50)
        print(f"Total jobs processed: {self.migration_stats['total_jobs']}")
        print(f"Successfully enhanced: {self.migration_stats['enhanced_jobs']}")
        print(f"Failed to enhance: {self.migration_stats['failed_jobs']}")
        print(f"Skipped (already exists): {self.migration_stats['skipped_jobs']}")
        print(f"Success rate: {(self.migration_stats['enhanced_jobs'] / max(self.migration_stats['total_jobs'], 1)) * 100:.1f}%")
        print("="*50)

async def main():
    """Main migration function"""
    if len(sys.argv) != 2:
        print("Usage: python migrate_jobs.py <consolidated_jobs_file.json>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)
    
    try:
        migration = JobDataMigration()
        await migration.migrate_jobs_from_consolidated_file(file_path, batch_size=5)
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
