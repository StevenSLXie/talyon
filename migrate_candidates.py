#!/usr/bin/env python3
"""
Candidate Profile Migration Script
Transforms existing JSON resume data to structured candidate profile format
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
import asyncio
from supabase import create_client, Client
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class CandidateProfileMigration:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if not all([self.supabase_url, self.supabase_key, self.openai_api_key]):
            raise ValueError("Missing required environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        openai.api_key = self.openai_api_key
        
        self.migration_stats = {
            'total_candidates': 0,
            'migrated_candidates': 0,
            'failed_candidates': 0,
            'skipped_candidates': 0
        }

    async def migrate_candidates_from_resumes(self, batch_size: int = 10):
        """Migrate candidates from existing resume data"""
        print("Starting candidate profile migration")
        
        # Get all resumes with JSON data
        try:
            result = self.supabase.table('resumes').select('*').not_.is_('json_resume', 'null').execute()
            resumes = result.data
        except Exception as e:
            print(f"Error fetching resumes: {e}")
            return
        
        self.migration_stats['total_candidates'] = len(resumes)
        print(f"Found {len(resumes)} resumes to migrate")
        
        # Process resumes in batches
        for i in range(0, len(resumes), batch_size):
            batch = resumes[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}/{(len(resumes) + batch_size - 1)//batch_size}")
            
            await self.process_resume_batch(batch)
            
            # Small delay between batches
            await asyncio.sleep(1)
        
        self.print_migration_summary()

    async def process_resume_batch(self, resumes: List[Dict[str, Any]]):
        """Process a batch of resumes"""
        for resume in resumes:
            try:
                await self.migrate_single_candidate(resume)
            except Exception as e:
                print(f"Failed to migrate candidate {resume.get('id', 'Unknown')}: {e}")
                self.migration_stats['failed_candidates'] += 1

    async def migrate_single_candidate(self, resume_data: Dict[str, Any]):
        """Migrate a single candidate's profile"""
        try:
            user_id = resume_data.get('user_id')
            if not user_id:
                print("No user_id found, skipping")
                self.migration_stats['skipped_candidates'] += 1
                return
            
            # Check if profile already exists
            existing_profile = await self.check_existing_profile(user_id)
            if existing_profile:
                print(f"Profile already exists for user {user_id}")
                self.migration_stats['skipped_candidates'] += 1
                return
            
            # Parse JSON resume
            json_resume = resume_data.get('json_resume')
            if not json_resume:
                print(f"No JSON resume data for user {user_id}")
                self.migration_stats['skipped_candidates'] += 1
                return
            
            # Enhance profile with LLM analysis
            enhanced_profile = await self.enhance_profile_with_llm(json_resume)
            
            if not enhanced_profile:
                print(f"Failed to enhance profile for user {user_id}")
                self.migration_stats['failed_candidates'] += 1
                return
            
            # Insert structured profile data
            await self.insert_structured_profile(user_id, enhanced_profile)
            
            self.migration_stats['migrated_candidates'] += 1
            print(f"Successfully migrated profile for user {user_id}")
            
        except Exception as e:
            print(f"Error migrating candidate {resume_data.get('id', 'Unknown')}: {e}")
            self.migration_stats['failed_candidates'] += 1

    async def check_existing_profile(self, user_id: str) -> bool:
        """Check if profile already exists"""
        try:
            result = self.supabase.table('candidate_basics').select('id').eq('user_id', user_id).execute()
            return len(result.data) > 0
        except Exception as e:
            print(f"Error checking existing profile: {e}")
            return False

    async def enhance_profile_with_llm(self, json_resume: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Enhance profile data using LLM analysis"""
        try:
            prompt = self.build_profile_enhancement_prompt(json_resume)
            
            response = await openai.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert career analyst specializing in the Singapore job market. Extract structured candidate profile data from JSON resume and return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            enhanced_profile = json.loads(response.choices[0].message.content)
            return enhanced_profile
            
        except Exception as e:
            print(f"LLM enhancement failed: {e}")
            return None

    def build_profile_enhancement_prompt(self, json_resume: Dict[str, Any]) -> str:
        """Build prompt for profile enhancement"""
        return f"""
        Analyze this JSON resume and extract structured candidate profile data in JSON format.
        
        Resume Data:
        {json.dumps(json_resume, indent=2)[:3000]}  # Limit to first 3000 chars
        
        Extract and return this JSON structure:
        {{
            "work_auth": {{
                "citizen_or_pr": true,
                "ep_ok": true,
                "sp_ok": false,
                "wp_ok": false
            }},
            "seniority_level": "Entry|Mid|Senior|Lead|Manager|Director|Executive",
            "current_title": "Current job title",
            "target_titles": ["Target Title 1", "Target Title 2"],
            "industries": ["Technology", "Finance", "Healthcare"],
            "company_tiers": ["MNC", "SME", "GLC"],
            "salary_expect_min": 5000,
            "salary_expect_max": 8000,
            "salary_currency": "SGD",
            "work_prefs": {{
                "remote_ok": true,
                "hybrid_ok": true,
                "onsite_ok": false,
                "job_types": ["Full Time", "Contract"]
            }},
            "intent": {{
                "open_to_work": true,
                "notice_period": "1 month",
                "urgency": "Medium"
            }},
            "activity": {{
                "last_active": "2024-01-15",
                "applications_count": 0
            }},
            "profile_version": "1.0",
            "extraction_meta": {{
                "source": "json_resume",
                "extracted_at": "{datetime.now().isoformat()}"
            }},
            "skills": [
                {{"name": "Python", "level": 4, "last_used": "2024-01-01", "evidence": "Used in current role", "skill_category": "Programming Languages"}},
                {{"name": "React", "level": 3, "last_used": "2023-12-01", "evidence": "Built frontend applications", "skill_category": "Frontend Development"}}
            ],
            "work_experience": [
                {{
                    "company": "Company Name",
                    "title": "Job Title",
                    "start_date": "2022-01-01",
                    "end_date": null,
                    "description": "Job description",
                    "company_tier": "MNC",
                    "job_family": "Engineering",
                    "seniority_level": "Senior",
                    "skills_used": ["Python", "React", "AWS"],
                    "achievements": ["Achievement 1", "Achievement 2"]
                }}
            ],
            "education": [
                {{
                    "institution": "University Name",
                    "area": "Computer Science",
                    "study_type": "Bachelor's Degree",
                    "start_date": "2018-09-01",
                    "end_date": "2022-06-01",
                    "gpa": "3.8"
                }}
            ],
            "certifications": [
                {{
                    "name": "AWS Certified Developer",
                    "issuer": "Amazon Web Services",
                    "issue_date": "2023-06-01",
                    "expiry_date": "2026-06-01"
                }}
            ]
        }}
        
        Guidelines:
        - Work auth: Infer from location (Singapore = likely citizen/PR), or explicitly stated
        - Seniority level: Based on years of experience and job titles
        - Target titles: Similar to current role or career progression
        - Industries: Extract from work experience
        - Company tiers: MNC for large companies, SME for smaller ones, GLC for government-linked
        - Salary expectations: Infer from current salary or market rates
        - Skills levels: 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master
        - Work preferences: Infer from job history and location
        - Extract all relevant skills, work experience, education, and certifications
        """

    async def insert_structured_profile(self, user_id: str, enhanced_profile: Dict[str, Any]):
        """Insert structured profile data into database"""
        try:
            # Insert candidate basics
            basics_data = {
                'user_id': user_id,
                'work_auth': enhanced_profile.get('work_auth', {}),
                'seniority_level': enhanced_profile.get('seniority_level', 'Mid'),
                'current_title': enhanced_profile.get('current_title', ''),
                'target_titles': enhanced_profile.get('target_titles', []),
                'industries': enhanced_profile.get('industries', []),
                'company_tiers': enhanced_profile.get('company_tiers', []),
                'salary_expect_min': enhanced_profile.get('salary_expect_min', 0),
                'salary_expect_max': enhanced_profile.get('salary_expect_max', 0),
                'salary_currency': enhanced_profile.get('salary_currency', 'SGD'),
                'work_prefs': enhanced_profile.get('work_prefs', {}),
                'intent': enhanced_profile.get('intent', {}),
                'activity': enhanced_profile.get('activity', {}),
                'profile_version': enhanced_profile.get('profile_version', '1.0'),
                'extraction_meta': enhanced_profile.get('extraction_meta', {}),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            self.supabase.table('candidate_basics').insert(basics_data).execute()
            
            # Insert skills
            skills = enhanced_profile.get('skills', [])
            if skills:
                skills_data = []
                for skill in skills:
                    skills_data.append({
                        'user_id': user_id,
                        'skill_name': skill.get('name', ''),
                        'level': skill.get('level', 3),
                        'last_used': skill.get('last_used', ''),
                        'evidence': skill.get('evidence', ''),
                        'skill_category': skill.get('skill_category', 'Other'),
                        'created_at': datetime.now().isoformat()
                    })
                
                self.supabase.table('candidate_skills').insert(skills_data).execute()
            
            # Insert work experience
            work_experience = enhanced_profile.get('work_experience', [])
            if work_experience:
                work_data = []
                for work in work_experience:
                    work_data.append({
                        'user_id': user_id,
                        'company': work.get('company', ''),
                        'title': work.get('title', ''),
                        'start_date': work.get('start_date', ''),
                        'end_date': work.get('end_date'),
                        'description': work.get('description', ''),
                        'company_tier': work.get('company_tier', 'SME'),
                        'job_family': work.get('job_family', 'Other'),
                        'seniority_level': work.get('seniority_level', 'Mid'),
                        'skills_used': work.get('skills_used', []),
                        'achievements': work.get('achievements', []),
                        'created_at': datetime.now().isoformat()
                    })
                
                self.supabase.table('candidate_work').insert(work_data).execute()
            
            # Insert education
            education = enhanced_profile.get('education', [])
            if education:
                education_data = []
                for edu in education:
                    education_data.append({
                        'user_id': user_id,
                        'institution': edu.get('institution', ''),
                        'area': edu.get('area', ''),
                        'study_type': edu.get('study_type', ''),
                        'start_date': edu.get('start_date', ''),
                        'end_date': edu.get('end_date'),
                        'gpa': edu.get('gpa'),
                        'created_at': datetime.now().isoformat()
                    })
                
                self.supabase.table('candidate_education').insert(education_data).execute()
            
            # Insert certifications
            certifications = enhanced_profile.get('certifications', [])
            if certifications:
                cert_data = []
                for cert in certifications:
                    cert_data.append({
                        'user_id': user_id,
                        'name': cert.get('name', ''),
                        'issuer': cert.get('issuer', ''),
                        'issue_date': cert.get('issue_date', ''),
                        'expiry_date': cert.get('expiry_date'),
                        'created_at': datetime.now().isoformat()
                    })
                
                self.supabase.table('candidate_certifications').insert(cert_data).execute()
                
        except Exception as e:
            print(f"Error inserting structured profile: {e}")
            raise

    def print_migration_summary(self):
        """Print migration summary"""
        print("\n" + "="*50)
        print("CANDIDATE PROFILE MIGRATION SUMMARY")
        print("="*50)
        print(f"Total candidates processed: {self.migration_stats['total_candidates']}")
        print(f"Successfully migrated: {self.migration_stats['migrated_candidates']}")
        print(f"Failed to migrate: {self.migration_stats['failed_candidates']}")
        print(f"Skipped (already exists): {self.migration_stats['skipped_candidates']}")
        print(f"Success rate: {(self.migration_stats['migrated_candidates'] / max(self.migration_stats['total_candidates'], 1)) * 100:.1f}%")
        print("="*50)

async def main():
    """Main migration function"""
    try:
        migration = CandidateProfileMigration()
        await migration.migrate_candidates_from_resumes(batch_size=5)
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
